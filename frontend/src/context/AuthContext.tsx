import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import type { User } from 'firebase/auth';
import {
    doc, getDoc, collectionGroup, query, where, getDocs,
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import type { UserProfile, Company, Branch } from '../types/user';

interface AuthContextType {
    currentUser: User | null;
    userProfile: UserProfile | null;
    loading: boolean;
    activeCompany: Company | null;
    activeBranch: Branch | null;
    setActiveCompanyId: (id: string) => void;
    setActiveBranchId: (id: string | null) => void;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [currentUser, setCurrentUser]       = useState<User | null>(null);
    const [userProfile, setUserProfile]       = useState<UserProfile | null>(null);
    const [loading, setLoading]               = useState(true);
    const [activeCompany, setActiveCompany]   = useState<Company | null>(null);
    const [activeBranch, setActiveBranch]     = useState<Branch | null>(null);
    const [overrideCompanyId, setOverrideCompanyId] = useState<string | null>(null);
    const [overrideBranchId, setOverrideBranchId]   = useState<string | null>(null);

    // ── Resolve user profile from Firestore ───────────────────────────────────
    const fetchProfile = async (user: User): Promise<UserProfile | null> => {
        try {
            const q = query(collectionGroup(db, 'users'), where('uid', '==', user.uid));
            const snap = await getDocs(q);
            if (!snap.empty) {
                const foundDoc = snap.docs[0];
                const profile = foundDoc.data() as UserProfile;
                const segs = foundDoc.ref.path.split('/');
                if (!profile.companyId && segs.includes('companies'))
                    profile.companyId = segs[segs.indexOf('companies') + 1];
                if (!profile.branchId && segs.includes('branches'))
                    profile.branchId = segs[segs.indexOf('branches') + 1];
                return profile;
            }
        } catch { /* fallthrough */ }
        // Fallback to root users collection
        const rootSnap = await getDoc(doc(db, 'users', user.uid));
        return rootSnap.exists() ? (rootSnap.data() as UserProfile) : null;
    };

    // ── Load company + branch when IDs change ─────────────────────────────────
    const loadCompanyAndBranch = async (companyId: string, branchId: string | null) => {
        const cSnap = await getDoc(doc(db, 'companies', companyId));
        if (cSnap.exists()) setActiveCompany({ id: cSnap.id, ...cSnap.data() } as Company);

        if (branchId && branchId !== 'null') {
            const bSnap = await getDoc(doc(db, 'companies', companyId, 'branches', branchId));
            if (bSnap.exists()) setActiveBranch({ id: bSnap.id, ...bSnap.data() } as Branch);
            else setActiveBranch(null);
        } else {
            setActiveBranch(null);
        }
    };

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (user) => {
            setCurrentUser(user);
            if (user) {
                const profile = await fetchProfile(user);
                setUserProfile(profile);
                if (profile?.companyId) {
                    await loadCompanyAndBranch(
                        overrideCompanyId ?? profile.companyId,
                        overrideBranchId  ?? profile.branchId ?? null,
                    );
                }
            } else {
                setUserProfile(null);
                setActiveCompany(null);
                setActiveBranch(null);
            }
            setLoading(false);
        });
        return unsub;
    }, []);

    // When super admin switches company
    const setActiveCompanyId = async (id: string) => {
        setOverrideCompanyId(id);
        setOverrideBranchId(null);
        await loadCompanyAndBranch(id, null);
    };

    const setActiveBranchId = async (id: string | null) => {
        setOverrideBranchId(id);
        const companyId = overrideCompanyId ?? userProfile?.companyId;
        if (companyId) await loadCompanyAndBranch(companyId, id);
    };

    const logout = async () => {
        await signOut(auth);
        setUserProfile(null);
        setActiveCompany(null);
        setActiveBranch(null);
        setOverrideCompanyId(null);
        setOverrideBranchId(null);
    };

    return (
        <AuthContext.Provider value={{
            currentUser, userProfile, loading,
            activeCompany, activeBranch,
            setActiveCompanyId, setActiveBranchId: (id) => { void setActiveBranchId(id); },
            logout,
        }}>
            {children}
        </AuthContext.Provider>
    );
};
