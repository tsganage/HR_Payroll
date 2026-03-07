import { useState, lazy, Suspense } from 'react';
import { useAuth } from '../context/AuthContext';
import { AppShell } from '../components/layout/AppShell';

export type HRTab =
    | 'dashboard' | 'employees' | 'attendance' | 'leaves'
    | 'payroll' | 'compliance' | 'expenses' | 'reports' | 'settings';

const HRSettingsPanel = lazy(() => import('../components/hr/HRSettingsPanel').then(m => ({ default: m.HRSettingsPanel })));

// Placeholder for panels not yet built
function ComingSoon({ title, phase, description }: { title: string; phase: number; description: string }) {
    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
            <div className="w-16 h-16 rounded-2xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center mb-4">
                <span className="text-2xl">🚧</span>
            </div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-1">{title}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mb-3">{description}</p>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 text-xs font-semibold">
                Phase {phase}
            </span>
        </div>
    );
}

const TAB_CONTENT: Record<HRTab, { phase: number; description: string }> = {
    dashboard:  { phase: 1, description: 'Payroll summary, attendance heatmap, upcoming paydays, and compliance alerts.' },
    employees:  { phase: 2, description: 'AI-assisted onboarding, face enrollment, org chart, and employee lifecycle management.' },
    attendance: { phase: 3, description: 'Selfie + GPS punch-in, geo-fence enforcement, shift management, and offline sync.' },
    leaves:     { phase: 4, description: 'Leave policies, approval workflows, holiday calendar, and leave encashment.' },
    payroll:    { phase: 5, description: 'Salary structures, automated payroll runs, payslip generation, and PF/ESI/TDS computation.' },
    compliance: { phase: 6, description: 'PF/ESI challan generation, PT returns, TDS Form 16, and e-filing.' },
    expenses:   { phase: 7, description: 'Reimbursement requests, advance management, GPS conveyance tracking, and approvals.' },
    reports:    { phase: 8, description: 'Payroll register, attendance summary, statutory reports, and MIS dashboards.' },
    settings:   { phase: 1, description: '' },
};

export default function HRApp() {
    const { userProfile, activeCompany, activeBranch } = useAuth();
    const [activeTab, setActiveTab] = useState<HRTab>('dashboard');

    const companyId = activeCompany?.id ?? '';
    const branchId  = activeBranch?.id ?? null;

    if (!userProfile || !companyId) {
        return (
            <div className="flex items-center justify-center min-h-screen text-slate-400 text-sm">
                Setting up workspace…
            </div>
        );
    }

    // Check hrModule access (unless super admin)
    if (userProfile.role !== 'SUPER_ADMIN' && !(activeCompany?.modules?.hrModule ?? false)) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen text-center px-4">
                <div className="w-16 h-16 rounded-2xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                </div>
                <h2 className="text-lg font-bold text-slate-800 dark:text-white">HR Module Not Enabled</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
                    The HR & Payroll module is not enabled for your workspace. Contact your administrator.
                </p>
            </div>
        );
    }

    const renderTab = () => {
        if (activeTab === 'settings') {
            return (
                <Suspense fallback={<div className="flex items-center justify-center h-64 text-slate-400 text-sm">Loading…</div>}>
                    <HRSettingsPanel
                        companyId={companyId}
                        branchId={branchId}
                        userProfile={userProfile}
                    />
                </Suspense>
            );
        }
        const { phase, description } = TAB_CONTENT[activeTab];
        return (
            <ComingSoon
                title={activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
                phase={phase}
                description={description}
            />
        );
    };

    return (
        <AppShell activeTab={activeTab} onTabChange={setActiveTab}>
            {renderTab()}
        </AppShell>
    );
}
