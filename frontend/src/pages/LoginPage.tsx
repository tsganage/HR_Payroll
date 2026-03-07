import { useState } from 'react';
import {
    signInWithPopup,
    GoogleAuthProvider,
    OAuthProvider,
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import toast, { Toaster } from 'react-hot-toast';

export default function LoginPage() {
    const [loading, setLoading] = useState<string | null>(null);

    const signIn = async (providerId: 'google' | 'microsoft' | 'yahoo') => {
        setLoading(providerId);
        try {
            let provider;
            if (providerId === 'google') provider = new GoogleAuthProvider();
            else if (providerId === 'microsoft') provider = new OAuthProvider('microsoft.com');
            else provider = new OAuthProvider('yahoo.com');

            await signInWithPopup(auth, provider);
            // AuthContext handles the rest
        } catch (err: any) {
            if (err.code !== 'auth/popup-closed-by-user')
                toast.error(err.message ?? 'Sign-in failed');
        } finally {
            setLoading(null);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-slate-100 dark:from-slate-900 dark:via-slate-800 dark:to-indigo-950 p-4">
            <Toaster position="top-center" />

            <div className="w-full max-w-sm">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-600 shadow-lg shadow-indigo-500/40 mb-4">
                        <svg className="w-9 h-9 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">HR Payroll</h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Novota · Powered by Gemini AI</p>
                </div>

                {/* Sign-in card */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-6 space-y-3">
                    <p className="text-xs text-center text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wide mb-4">
                        Sign in to continue
                    </p>

                    <OAuthButton
                        label="Continue with Google"
                        loading={loading === 'google'}
                        onClick={() => signIn('google')}
                        icon={
                            <svg className="w-5 h-5" viewBox="0 0 24 24">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                            </svg>
                        }
                    />
                    <OAuthButton
                        label="Continue with Microsoft"
                        loading={loading === 'microsoft'}
                        onClick={() => signIn('microsoft')}
                        icon={
                            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                                <rect x="1" y="1" width="10" height="10" fill="#F25022"/>
                                <rect x="13" y="1" width="10" height="10" fill="#7FBA00"/>
                                <rect x="1" y="13" width="10" height="10" fill="#00A4EF"/>
                                <rect x="13" y="13" width="10" height="10" fill="#FFB900"/>
                            </svg>
                        }
                    />
                    <OAuthButton
                        label="Continue with Yahoo"
                        loading={loading === 'yahoo'}
                        onClick={() => signIn('yahoo')}
                        icon={
                            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#6001D2">
                                <path d="M19.6 4l-4.4 9.3-4.4-9.3H7l6.2 12.9v4.1h2.8v-4.1L22 4h-2.4zM2 15.3h2.8v5.6H2z"/>
                            </svg>
                        }
                    />
                </div>

                <p className="text-center text-xs text-slate-400 mt-6">
                    Access is restricted to authorised workspace members only.
                </p>
            </div>
        </div>
    );
}

function OAuthButton({ label, icon, onClick, loading }: {
    label: string; icon: React.ReactNode; onClick: () => void; loading: boolean;
}) {
    return (
        <button
            onClick={onClick}
            disabled={loading}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors text-sm font-medium text-slate-700 dark:text-slate-200 disabled:opacity-60"
        >
            {loading
                ? <span className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                : icon}
            {label}
        </button>
    );
}
