import { useState, useEffect } from 'react';
import {
    doc, getDoc, setDoc, serverTimestamp,
    collection, getDocs, query, where, writeBatch,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { UserProfile } from '../../types/user';
import type { HrSettings } from '../../types/hr';
import {
    HR_SETTINGS_DEFAULTS,
    HR_GL_SEEDS,
    HR_STATUTORY_SEED_ADDITION,
    HR_STATUTORY_GL_UPDATES,
    PT_STATE_LABELS,
} from '../../types/hr';

interface HRSettingsPanelProps {
    companyId: string;
    branchId: string | null;
    userProfile: UserProfile;
}

const inp = 'w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-400';
const lbl = 'block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1';
const sec = 'text-xs font-bold text-slate-400 uppercase tracking-wide border-b border-slate-100 dark:border-slate-700 pb-1.5 mb-3 mt-5 first:mt-0';

// Firestore path: per-branch if branchId, else company-level
function settingsDocRef(companyId: string, branchId: string | null) {
    const key = branchId || 'company';
    return doc(db, 'companies', companyId, 'hr_settings', key);
}

export function HRSettingsPanel({ companyId, branchId, userProfile }: HRSettingsPanelProps) {
    const [settings, setSettings] = useState<HrSettings>(HR_SETTINGS_DEFAULTS as HrSettings);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isBootstrapping, setIsBootstrapping] = useState(false);
    const [bootstrapStatus, setBootstrapStatus] = useState<string[]>([]);
    const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);

    const isAdmin = ['SUPER_ADMIN', 'COMPANY_ADMIN', 'BRANCH_ADMIN'].includes(userProfile.role);
    const contextLabel = branchId ? 'Branch' : 'Company';

    // ── Load settings ──────────────────────────────────────────────────────────
    useEffect(() => {
        setIsLoading(true);
        getDoc(settingsDocRef(companyId, branchId)).then(snap => {
            if (snap.exists()) {
                setSettings({ id: snap.id, ...HR_SETTINGS_DEFAULTS, ...snap.data() } as HrSettings);
            }
            setIsLoading(false);
        }).catch(() => setIsLoading(false));
    }, [companyId, branchId]);

    // ── Save settings ──────────────────────────────────────────────────────────
    const handleSave = async () => {
        if (!isAdmin) return;
        setIsSaving(true);
        try {
            const { id: _id, ...payload } = settings;
            await setDoc(settingsDocRef(companyId, branchId), {
                ...payload,
                updatedAt: serverTimestamp(),
                updatedBy: userProfile.uid,
            }, { merge: true });
            showToast(true, `HR Settings saved for this ${contextLabel.toLowerCase()}`);
        } catch (err) {
            showToast(false, err instanceof Error ? err.message : 'Save failed');
        } finally {
            setIsSaving(false);
        }
    };

    // ── Bootstrap GL accounts + statutory parties ──────────────────────────────
    const handleBootstrap = async () => {
        if (!isAdmin) return;
        setIsBootstrapping(true);
        setBootstrapStatus([]);
        const log = (msg: string) => setBootstrapStatus(prev => [...prev, msg]);

        try {
            const batch = writeBatch(db);

            // 1. Seed new HR GL accounts (skip if already exist)
            log('Checking HR GL accounts…');
            const glCol = collection(db, 'companies', companyId, 'acc_glAccounts');
            const existingGl = await getDocs(glCol);
            const existingCodes = new Set(existingGl.docs.map(d => d.id));
            let glAdded = 0;

            for (const gl of HR_GL_SEEDS) {
                if (!existingCodes.has(gl.glCode)) {
                    batch.set(doc(glCol, gl.glCode), {
                        ...gl,
                        isActive: true,
                        openingBalance: 0,
                        createdAt: serverTimestamp(),
                    });
                    glAdded++;
                }
            }
            log(glAdded > 0 ? `  ✓ Added ${glAdded} HR GL accounts` : '  — HR GL accounts already present');

            // 2. Update existing PF/ESI/PT statutory parties with GL codes
            log('Updating statutory party GL codes…');
            const partiesCol = collection(db, 'companies', companyId, 'acc_parties');
            const staSnap = await getDocs(
                query(partiesCol, where('partyType', '==', 'statutory'))
            );
            let staUpdated = 0;

            for (const staDoc of staSnap.docs) {
                const partyCode = staDoc.data().partyCode as string;
                const newGl = HR_STATUTORY_GL_UPDATES[partyCode];
                if (newGl && !staDoc.data().glCode) {
                    batch.update(doc(partiesCol, staDoc.id), {
                        glCode: newGl,
                        updatedAt: serverTimestamp(),
                    });
                    staUpdated++;
                }
            }
            log(staUpdated > 0 ? `  ✓ Updated ${staUpdated} statutory party GL codes` : '  — Statutory GL codes already set');

            // 3. Add STA/0015 (TDS u/s 192 — Salary) if not present
            log('Checking STA/0015 (TDS on Salary)…');
            const sta15Snap = await getDocs(
                query(partiesCol, where('partyCode', '==', 'STA/0015'))
            );
            if (sta15Snap.empty) {
                batch.set(doc(partiesCol), {
                    ...HR_STATUTORY_SEED_ADDITION,
                    companyId,
                    isActive: true,
                    createdAt: serverTimestamp(),
                    createdBy: userProfile.uid,
                });
                log('  ✓ Added STA/0015 — TDS u/s 192 (Salary)');
            } else {
                log('  — STA/0015 already present');
            }

            await batch.commit();
            log('Bootstrap complete.');
            showToast(true, 'HR accounts bootstrapped successfully');
        } catch (err) {
            log(`  ✗ Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
            showToast(false, 'Bootstrap failed — check logs');
        } finally {
            setIsBootstrapping(false);
        }
    };

    const showToast = (ok: boolean, msg: string) => {
        setToast({ ok, msg });
        setTimeout(() => setToast(null), 3500);
    };

    const f = <K extends keyof HrSettings>(key: K, val: HrSettings[K]) =>
        setSettings(prev => ({ ...prev, [key]: val }));

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64 text-slate-400">
                <svg className="w-5 h-5 animate-spin mr-2" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Loading HR settings…
            </div>
        );
    }

    return (
        <div className="max-w-4xl space-y-6">

            {/* Context banner */}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800">
                <svg className="w-5 h-5 text-indigo-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-indigo-700 dark:text-indigo-300">
                    These settings apply to this <strong>{contextLabel}</strong>
                    {branchId ? ` (Branch ID: ${branchId})` : ''}.
                    Each branch maintains its own independent HR configuration.
                </p>
            </div>

            {/* ── Bootstrap Card ─────────────────────────────────────────────── */}
            {isAdmin && (
                <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10 p-5">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                                Initialize HR Accounting Data
                            </h4>
                            <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                                Seeds HR GL accounts (220100–420050), updates PF/ESI/PT statutory
                                party GL codes (STA/0009–0014), and adds STA/0015 (TDS u/s 192 Salary).
                                Safe to run multiple times — skips existing entries.
                            </p>
                        </div>
                        <button
                            onClick={handleBootstrap}
                            disabled={isBootstrapping}
                            className="flex-shrink-0 px-4 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors disabled:opacity-60"
                        >
                            {isBootstrapping ? 'Running…' : 'Run Bootstrap'}
                        </button>
                    </div>
                    {bootstrapStatus.length > 0 && (
                        <div className="mt-3 p-3 bg-white/60 dark:bg-slate-800/60 rounded-lg font-mono text-xs text-slate-700 dark:text-slate-300 space-y-0.5">
                            {bootstrapStatus.map((line, i) => (
                                <div key={i}>{line}</div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ── Settings Form ───────────────────────────────────────────────── */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 space-y-6">

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-x-10 gap-y-8">

                    {/* ── Col 1: Statutory Applicability ─────────────────────────── */}
                    <div className="space-y-3">
                        <p className={sec}>Statutory Applicability</p>
                        <p className="text-xs text-slate-400 -mt-2">
                            Enable only the deductions that apply to this establishment. Not all companies are covered under every statute.
                        </p>
                        <StatutoryToggle
                            id="pfApplicable"
                            enabled={settings.pfApplicable ?? false}
                            onChange={v => f('pfApplicable', v)}
                            disabled={!isAdmin}
                            label="Provident Fund (PF / EPF)"
                            note="Mandatory for establishments with 20+ employees. Voluntary for smaller establishments."
                            badge="20+ employees"
                        />
                        <StatutoryToggle
                            id="esiApplicable"
                            enabled={settings.esiApplicable ?? false}
                            onChange={v => f('esiApplicable', v)}
                            disabled={!isAdmin}
                            label="Employee State Insurance (ESI / ESIC)"
                            note="Applicable for establishments with 10+ employees. Only for employees earning ≤₹21,000/month."
                            badge="10+ employees"
                        />
                        <StatutoryToggle
                            id="ptApplicable"
                            enabled={settings.ptApplicable ?? false}
                            onChange={v => f('ptApplicable', v)}
                            disabled={!isAdmin}
                            label="Professional Tax (PT)"
                            note="Applicable only in states that levy PT: Maharashtra, Karnataka, West Bengal, Andhra Pradesh, Telangana, Tamil Nadu, Gujarat, and a few others."
                            badge="State-specific"
                        />
                        <StatutoryToggle
                            id="lwfApplicable"
                            enabled={settings.lwfApplicable ?? false}
                            onChange={v => f('lwfApplicable', v)}
                            disabled={!isAdmin}
                            label="Labour Welfare Fund (LWF)"
                            note="State-specific fund. Applicable in AP, Gujarat, Karnataka, MP, Maharashtra, Tamil Nadu, and a few others."
                            badge="State-specific"
                        />
                    </div>

                    {/* ── Col 2: Payroll Configuration ────────────────────────────── */}
                    <div className="space-y-3">
                        <p className={sec}>Payroll Configuration</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className={lbl}>Payroll Cycle</label>
                                <select
                                    value={settings.payrollCycle}
                                    onChange={e => f('payrollCycle', e.target.value as HrSettings['payrollCycle'])}
                                    className={inp}
                                    disabled={!isAdmin}
                                >
                                    <option value="calendar">Calendar Month (1st – Last day)</option>
                                    <option value="custom">Custom Cycle (26th – 25th)</option>
                                </select>
                            </div>
                            <div>
                                <label className={lbl}>Payday Rule</label>
                                <select
                                    value={settings.paydayRule}
                                    onChange={e => f('paydayRule', e.target.value as HrSettings['paydayRule'])}
                                    className={inp}
                                    disabled={!isAdmin}
                                >
                                    <option value="last_working_day">Last Working Day of Month</option>
                                    <option value="fixed_date">Fixed Date</option>
                                </select>
                            </div>
                            {settings.paydayRule === 'fixed_date' && (
                                <div>
                                    <label className={lbl}>Fixed Payday (date of month)</label>
                                    <input
                                        type="number"
                                        min={1} max={31}
                                        value={settings.paydayFixedDate || ''}
                                        onChange={e => f('paydayFixedDate', Number(e.target.value))}
                                        className={inp}
                                        placeholder="e.g. 28"
                                        disabled={!isAdmin}
                                    />
                                </div>
                            )}
                            <div>
                                <label className={lbl}>OT Rate Multiplier</label>
                                <select
                                    value={settings.overtimeRateMultiplier}
                                    onChange={e => f('overtimeRateMultiplier', Number(e.target.value) as 1 | 1.5 | 2)}
                                    className={inp}
                                    disabled={!isAdmin}
                                >
                                    <option value={1}>1× (Same rate)</option>
                                    <option value={1.5}>1.5× (Time and a half)</option>
                                    <option value={2}>2× (Double time)</option>
                                </select>
                            </div>
                            <div>
                                <label className={lbl}>Standard Hours / Day (before OT)</label>
                                <input
                                    type="number"
                                    min={4} max={12} step={0.5}
                                    value={settings.overtimeAfterHours}
                                    onChange={e => f('overtimeAfterHours', Number(e.target.value))}
                                    className={inp}
                                    disabled={!isAdmin}
                                />
                            </div>
                        </div>
                    </div>

                    {/* ── Full width: Statutory Registration Numbers ────────────── */}
                    {(settings.pfApplicable || settings.esiApplicable || settings.ptApplicable || settings.tan) && (
                        <div className="xl:col-span-2 space-y-3">
                            <p className={sec}>Statutory Registration Numbers</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {settings.pfApplicable && (
                                    <div>
                                        <label className={lbl}>PF Registration Number (EPFO)</label>
                                        <input
                                            value={settings.pfRegistrationNumber || ''}
                                            onChange={e => f('pfRegistrationNumber', e.target.value)}
                                            className={`${inp} font-mono`}
                                            placeholder="MHBAN1234567000"
                                            disabled={!isAdmin}
                                        />
                                    </div>
                                )}
                                {settings.esiApplicable && (
                                    <div>
                                        <label className={lbl}>ESI Employer Code</label>
                                        <input
                                            value={settings.esiCode || ''}
                                            onChange={e => f('esiCode', e.target.value)}
                                            className={`${inp} font-mono`}
                                            placeholder="41-00-123456-000-0001"
                                            disabled={!isAdmin}
                                        />
                                    </div>
                                )}
                                <div>
                                    <label className={lbl}>TAN (for TDS on Salary)</label>
                                    <input
                                        value={settings.tan || ''}
                                        onChange={e => f('tan', e.target.value.toUpperCase())}
                                        className={`${inp} font-mono`}
                                        placeholder="MUMB12345A"
                                        maxLength={10}
                                        disabled={!isAdmin}
                                    />
                                    <p className="text-xs text-slate-400 mt-0.5">Required for TDS u/s 192 on salary payments.</p>
                                </div>
                                {settings.ptApplicable && (
                                    <>
                                        <div>
                                            <label className={lbl}>Professional Tax State</label>
                                            <select
                                                value={settings.ptState || ''}
                                                onChange={e => f('ptState', e.target.value)}
                                                className={inp}
                                                disabled={!isAdmin}
                                            >
                                                <option value="">Select state…</option>
                                                {Object.entries(PT_STATE_LABELS).map(([code, name]) => (
                                                    <option key={code} value={code}>{name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        {settings.ptState && (
                                            <div>
                                                <label className={lbl}>PT Registration Number</label>
                                                <input
                                                    value={settings.ptRegistrationNumber || ''}
                                                    onChange={e => f('ptRegistrationNumber', e.target.value)}
                                                    className={`${inp} font-mono`}
                                                    placeholder="PT registration number"
                                                    disabled={!isAdmin}
                                                />
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ── Col 1: Attendance Rules ──────────────────────────────────── */}
                    <div className="space-y-3">
                        <p className={sec}>Attendance Rules</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className={lbl}>Grace Period (minutes)</label>
                                <input
                                    type="number"
                                    min={0} max={60}
                                    value={settings.graceMinutes}
                                    onChange={e => f('graceMinutes', Number(e.target.value))}
                                    className={inp}
                                    disabled={!isAdmin}
                                />
                                <p className="text-xs text-slate-400 mt-0.5">Employee can be late by this many minutes without a fine.</p>
                            </div>
                            <div>
                                <label className={lbl}>Half-Day Threshold (hours)</label>
                                <input
                                    type="number"
                                    min={1} max={8} step={0.5}
                                    value={settings.halfDayThresholdHours}
                                    onChange={e => f('halfDayThresholdHours', Number(e.target.value))}
                                    className={inp}
                                    disabled={!isAdmin}
                                />
                                <p className="text-xs text-slate-400 mt-0.5">Working hours below this = half day.</p>
                            </div>
                            <div>
                                <label className={lbl}>Late Fine Mode</label>
                                <select
                                    value={settings.lateFineMode}
                                    onChange={e => f('lateFineMode', e.target.value as HrSettings['lateFineMode'])}
                                    className={inp}
                                    disabled={!isAdmin}
                                >
                                    <option value="none">No Late Fine</option>
                                    <option value="proportional">Proportional (exact minutes deducted)</option>
                                    <option value="per_slot">Per Slot (deduct per N-minute block)</option>
                                </select>
                            </div>
                            {settings.lateFineMode === 'per_slot' && (
                                <div>
                                    <label className={lbl}>Slot Size (minutes)</label>
                                    <input
                                        type="number"
                                        min={5} max={60} step={5}
                                        value={settings.lateSlotMinutes || 15}
                                        onChange={e => f('lateSlotMinutes', Number(e.target.value))}
                                        className={inp}
                                        disabled={!isAdmin}
                                    />
                                    <p className="text-xs text-slate-400 mt-0.5">Each block = one slot-worth of salary deducted.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ── Col 2: Compliance Rules ──────────────────────────────────── */}
                    <div className="space-y-3">
                        <p className={sec}>Compliance Rules (India 2026)</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="sm:col-span-2">
                                <label className={lbl}>50% Wage Rule Enforcement</label>
                                <select
                                    value={settings.wageRuleEnforcement}
                                    onChange={e => f('wageRuleEnforcement', e.target.value as HrSettings['wageRuleEnforcement'])}
                                    className={inp}
                                    disabled={!isAdmin}
                                >
                                    <option value="off">Off (no check)</option>
                                    <option value="warn">Warn (show alert, allow save)</option>
                                    <option value="block">Block (cannot save non-compliant structure)</option>
                                </select>
                                <p className="text-xs text-slate-400 mt-0.5">Basic salary must be ≥50% of gross CTC (India 2026).</p>
                            </div>
                            {settings.esiApplicable && (
                                <div>
                                    <label className={lbl}>ESI Wage Ceiling (₹/month)</label>
                                    <input
                                        type="number"
                                        value={settings.esiWageCeiling}
                                        onChange={e => f('esiWageCeiling', Number(e.target.value))}
                                        className={`${inp} font-mono`}
                                        disabled={!isAdmin}
                                    />
                                    <p className="text-xs text-slate-400 mt-0.5">ESI applies only if employee gross ≤ this amount.</p>
                                </div>
                            )}
                            {settings.pfApplicable && (
                                <div className="sm:col-span-2 flex items-center gap-3">
                                    <input
                                        type="checkbox"
                                        id="pfWageCap"
                                        checked={settings.pfWageCapEnabled}
                                        onChange={e => f('pfWageCapEnabled', e.target.checked)}
                                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                        disabled={!isAdmin}
                                    />
                                    <label htmlFor="pfWageCap" className="text-sm text-slate-600 dark:text-slate-300 cursor-pointer">
                                        Cap PF on ₹15,000 basic (employee contributes max ₹1,800/month)
                                    </label>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ── Full width: Geo-fence ─────────────────────────────────────── */}
                    <div className="xl:col-span-2 space-y-3">
                        <p className={sec}>Geo-fence (Attendance)</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="sm:col-span-2 lg:col-span-4 flex items-center gap-3">
                                <input
                                    type="checkbox"
                                    id="geofenceEnabled"
                                    checked={settings.geofenceEnabled}
                                    onChange={e => f('geofenceEnabled', e.target.checked)}
                                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                    disabled={!isAdmin}
                                />
                                <label htmlFor="geofenceEnabled" className="text-sm text-slate-600 dark:text-slate-300 cursor-pointer">
                                    Enable geo-fence — restrict punch-in to within radius of office
                                </label>
                            </div>
                            {settings.geofenceEnabled && (
                                <>
                                    <div>
                                        <label className={lbl}>Radius (metres)</label>
                                        <input
                                            type="number"
                                            min={25} max={5000} step={25}
                                            value={settings.geofenceRadiusMeters}
                                            onChange={e => f('geofenceRadiusMeters', Number(e.target.value))}
                                            className={inp}
                                            disabled={!isAdmin}
                                        />
                                    </div>
                                    <div>
                                        <label className={lbl}>Office Latitude</label>
                                        <input
                                            type="number"
                                            step="any"
                                            value={settings.geofenceCoordinates?.lat ?? ''}
                                            onChange={e => f('geofenceCoordinates', {
                                                lat: parseFloat(e.target.value) || 0,
                                                lng: settings.geofenceCoordinates?.lng ?? 0,
                                            })}
                                            className={`${inp} font-mono`}
                                            placeholder="19.0760"
                                            disabled={!isAdmin}
                                        />
                                    </div>
                                    <div>
                                        <label className={lbl}>Office Longitude</label>
                                        <input
                                            type="number"
                                            step="any"
                                            value={settings.geofenceCoordinates?.lng ?? ''}
                                            onChange={e => f('geofenceCoordinates', {
                                                lat: settings.geofenceCoordinates?.lat ?? 0,
                                                lng: parseFloat(e.target.value) || 0,
                                            })}
                                            className={`${inp} font-mono`}
                                            placeholder="72.8777"
                                            disabled={!isAdmin}
                                        />
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* ── Full width: RazorpayX ─────────────────────────────────────── */}
                    <div className="xl:col-span-2 space-y-3">
                        <p className={sec}>Payroll Disbursement (RazorpayX)</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div>
                                <label className={lbl}>RazorpayX Key ID</label>
                                <input
                                    value={settings.razorpayxKeyId || ''}
                                    onChange={e => f('razorpayxKeyId', e.target.value)}
                                    className={`${inp} font-mono`}
                                    placeholder="rzp_live_xxxxxxxxxx"
                                    disabled={!isAdmin}
                                />
                            </div>
                            <div>
                                <label className={lbl}>RazorpayX Key Secret</label>
                                <input
                                    type="password"
                                    value={settings.razorpayxKeySecret || ''}
                                    onChange={e => f('razorpayxKeySecret', e.target.value)}
                                    className={`${inp} font-mono`}
                                    placeholder="••••••••••••••••"
                                    disabled={!isAdmin}
                                />
                                <p className="text-xs text-slate-400 mt-0.5">Stored encrypted. Never sent to browser after save.</p>
                            </div>
                        </div>
                    </div>

                    {/* ── Full width: Earned Wage Access ────────────────────────────── */}
                    <div className="xl:col-span-2 space-y-3">
                        <p className={sec}>Earned Wage Access (On-Demand Pay)</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="sm:col-span-2 lg:col-span-4 flex items-center gap-3">
                                <input
                                    type="checkbox"
                                    id="earnedWageEnabled"
                                    checked={settings.earnedWageEnabled}
                                    onChange={e => f('earnedWageEnabled', e.target.checked)}
                                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                    disabled={!isAdmin}
                                />
                                <label htmlFor="earnedWageEnabled" className="text-sm text-slate-600 dark:text-slate-300 cursor-pointer">
                                    Allow employees to withdraw earned salary mid-month
                                </label>
                            </div>
                            {settings.earnedWageEnabled && (
                                <>
                                    <div>
                                        <label className={lbl}>Max Withdrawable (%)</label>
                                        <input
                                            type="number"
                                            min={10} max={80} step={5}
                                            value={settings.earnedWageMaxPercent}
                                            onChange={e => f('earnedWageMaxPercent', Number(e.target.value))}
                                            className={inp}
                                            disabled={!isAdmin}
                                        />
                                        <p className="text-xs text-slate-400 mt-0.5">% of earned salary available to withdraw.</p>
                                    </div>
                                    <div>
                                        <label className={lbl}>Min Days Worked (before access)</label>
                                        <input
                                            type="number"
                                            min={1} max={25}
                                            value={settings.earnedWageMinDaysWorked}
                                            onChange={e => f('earnedWageMinDaysWorked', Number(e.target.value))}
                                            className={inp}
                                            disabled={!isAdmin}
                                        />
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                </div>{/* end grid */}

                {/* Save button */}
                {isAdmin && (
                    <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-700">
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="px-6 py-2.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-lg shadow-indigo-500/25 transition-colors disabled:opacity-50"
                        >
                            {isSaving ? 'Saving…' : `Save ${contextLabel} HR Settings`}
                        </button>
                    </div>
                )}

            </div>{/* end form card */}

            {/* Toast */}
            {toast && (
                <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white transition-all ${toast.ok ? 'bg-indigo-600' : 'bg-red-600'}`}>
                    {toast.msg}
                </div>
            )}
        </div>
    );
}

// ── StatutoryToggle helper ─────────────────────────────────────────────────────

function StatutoryToggle({
    id, enabled, onChange, disabled, label, note, badge,
}: {
    id: string;
    enabled: boolean;
    onChange: (v: boolean) => void;
    disabled: boolean;
    label: string;
    note: string;
    badge: string;
}) {
    return (
        <div className={`flex items-start justify-between gap-4 p-3 rounded-xl border transition-colors ${
            enabled
                ? 'bg-indigo-50/60 border-indigo-200 dark:bg-indigo-900/20 dark:border-indigo-800/60'
                : 'bg-slate-50 border-slate-200 dark:bg-slate-700/30 dark:border-slate-700'
        }`}>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{label}</span>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-600 text-slate-500 dark:text-slate-400">
                        {badge}
                    </span>
                    {enabled && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                            Active
                        </span>
                    )}
                </div>
                <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{note}</p>
            </div>
            <button
                id={id}
                type="button"
                role="switch"
                aria-checked={enabled}
                disabled={disabled}
                onClick={() => onChange(!enabled)}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
                    enabled ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-600'
                }`}
            >
                <span className="sr-only">Toggle {label}</span>
                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
                    enabled ? 'translate-x-5' : 'translate-x-0'
                }`} />
            </button>
        </div>
    );
}
