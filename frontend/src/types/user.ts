// Mirrors Invoice Digitizer's user types — same Firebase project, same Firestore schema

export type UserRole = 'SUPER_ADMIN' | 'COMPANY_ADMIN' | 'BRANCH_ADMIN' | 'USER';

export interface UserProfile {
    uid: string;
    email: string | null;
    displayName: string | null;
    photoURL: string | null;
    role: UserRole;
    companyId?: string;
    companyName?: string;
    branchId?: string;
    branchName?: string;
    createdAt: any;
}

export interface Company {
    id: string;
    name: string;
    type: 'WITH_BRANCH' | 'WITHOUT_BRANCH';
    createdAt: any;
    createdBy: string;
    modules?: {
        invoiceDigitizer?: boolean;
        mmsModule?:        boolean;
        accountsModule?:   boolean;
        salesDigitizer?:   boolean;
        mastersModule?:    boolean;
        tallyModule?:      boolean;
        restaurantModule?: boolean;
        hrModule?:         boolean;
    };
}

export interface Branch {
    id: string;
    companyId: string;
    name: string;
    location?: string;
    createdAt: any;
}
