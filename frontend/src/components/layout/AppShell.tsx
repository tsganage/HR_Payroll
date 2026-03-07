import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import type { HRTab } from '../../pages/HRApp';

const NAV_ITEMS: { tab: HRTab; label: string; icon: string }[] = [
    { tab: 'dashboard',  label: 'Dashboard',  icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { tab: 'employees',  label: 'Employees',  icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
    { tab: 'attendance', label: 'Attendance', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
    { tab: 'leaves',     label: 'Leaves',     icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
    { tab: 'payroll',    label: 'Payroll',    icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z' },
    { tab: 'compliance', label: 'Compliance', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
    { tab: 'expenses',   label: 'Expenses',   icon: 'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z' },
    { tab: 'reports',    label: 'Reports',    icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
    { tab: 'settings',   label: 'Settings',   icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
];

interface AppShellProps {
    activeTab: HRTab;
    onTabChange: (tab: HRTab) => void;
    children: React.ReactNode;
}

export function AppShell({ activeTab, onTabChange, children }: AppShellProps) {
    const { userProfile, activeCompany, activeBranch, logout } = useAuth();
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const contextLabel = activeBranch?.name
        ? `${activeCompany?.name} · ${activeBranch.name}`
        : activeCompany?.name ?? '—';

    return (
        <div className="flex h-screen overflow-hidden bg-slate-100 dark:bg-slate-900">

            {/* ── Mobile overlay ─────────────────────────────────────────────── */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 z-20 bg-black/50 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* ── Sidebar ────────────────────────────────────────────────────── */}
            <aside className={`fixed inset-y-0 left-0 z-30 w-64 flex flex-col bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 transform transition-transform duration-200 lg:relative lg:translate-x-0 ${
                sidebarOpen ? 'translate-x-0' : '-translate-x-full'
            }`}>
                {/* Brand */}
                <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex-shrink-0">
                    <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-800 dark:text-white leading-tight">HR Payroll</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{contextLabel}</p>
                    </div>
                </div>

                {/* Nav */}
                <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
                    {NAV_ITEMS.map(({ tab, label, icon }) => (
                        <button
                            key={tab}
                            onClick={() => { onTabChange(tab); setSidebarOpen(false); }}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
                                activeTab === tab
                                    ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 hover:text-slate-800 dark:hover:text-slate-200'
                            }`}
                        >
                            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                {icon.split(' M').map((d, i) => (
                                    <path key={i} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={i === 0 ? d : 'M' + d} />
                                ))}
                            </svg>
                            {label}
                        </button>
                    ))}
                </nav>

                {/* User footer */}
                <div className="border-t border-slate-100 dark:border-slate-700 p-3 flex-shrink-0">
                    <div className="flex items-center gap-3 px-2">
                        {userProfile?.photoURL
                            ? <img src={userProfile.photoURL} className="w-8 h-8 rounded-full" alt="" />
                            : <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400 text-sm font-bold">
                                {userProfile?.displayName?.[0] ?? '?'}
                              </div>
                        }
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">{userProfile?.displayName}</p>
                            <p className="text-[10px] text-slate-400 truncate">{userProfile?.role}</p>
                        </div>
                        <button onClick={logout} title="Sign out"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                        </button>
                    </div>
                </div>
            </aside>

            {/* ── Main content ───────────────────────────────────────────────── */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Mobile topbar */}
                <header className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 lg:hidden flex-shrink-0">
                    <button onClick={() => setSidebarOpen(true)} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                    </button>
                    <span className="text-sm font-semibold text-slate-800 dark:text-white">
                        {NAV_ITEMS.find(n => n.tab === activeTab)?.label ?? 'HR Payroll'}
                    </span>
                </header>

                {/* Page content */}
                <main className="flex-1 overflow-y-auto p-4 lg:p-6">
                    {children}
                </main>
            </div>
        </div>
    );
}
