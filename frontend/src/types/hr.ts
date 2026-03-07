import type { Timestamp } from 'firebase/firestore';

// ─── HR Settings ──────────────────────────────────────────────────────────────

export interface HrSettings {
    id?: string;

    // Company statutory registrations
    pfRegistrationNumber?: string;     // EPFO registration
    esiCode?: string;                  // ESIC employer code
    tan?: string;                      // TAN for TDS deduction
    ptState?: string;                  // Primary state for Professional Tax
    ptRegistrationNumber?: string;

    // Payroll cycle
    payrollCycle: 'calendar' | 'custom'; // calendar = 1st to last; custom = 26th to 25th
    payrollCycleStartDay?: number;       // 1 or 26
    paydayRule: 'fixed_date' | 'last_working_day';
    paydayFixedDate?: number;            // e.g. 31 (will use last day of month if month is shorter)

    // Attendance rules
    graceMinutes: number;                // Late grace buffer (default 15)
    lateFineMode: 'proportional' | 'per_slot' | 'none';
    lateSlotMinutes?: number;            // For per_slot: deduct per N-minute slot
    halfDayThresholdHours: number;       // Hours below which = half day (default 4)
    overtimeAfterHours: number;          // Standard shift hours before OT kicks in (default 8)
    overtimeRateMultiplier: 1 | 1.5 | 2; // OT pay multiplier

    // Statutory applicability — not all companies are mandatorily covered
    pfApplicable: boolean;               // PF mandatory for 20+ employees; voluntary otherwise
    esiApplicable: boolean;              // ESI mandatory for 10+ employees (state-dependent)
    ptApplicable: boolean;               // PT only in states that levy it (MH, KA, WB, etc.)
    lwfApplicable: boolean;              // Labour Welfare Fund — state-specific

    // Compliance
    wageRuleEnforcement: 'off' | 'warn' | 'block'; // 50% Basic Wage Rule (India 2026)
    pfWageCapEnabled: boolean;           // Cap PF calculation at ₹15,000 basic
    esiWageCeiling: number;              // ESI applicable if gross ≤ this (default 21000)

    // Geo-fence
    geofenceEnabled: boolean;
    geofenceRadiusMeters: number;        // default 100
    geofenceCoordinates?: {              // Per-branch override set in branch settings
        lat: number;
        lng: number;
    };

    // Payments
    razorpayxKeyId?: string;             // RazorpayX key (masked in UI)
    razorpayxKeySecret?: string;         // Stored encrypted — never sent to frontend
    bankAccountId?: string;              // RazorpayX fund account ID

    // Earned Wage Access
    earnedWageEnabled: boolean;
    earnedWageMaxPercent: number;        // % of earned salary withdrawable (default 40)
    earnedWageMinDaysWorked: number;     // Min days worked before access (default 10)

    updatedAt?: Timestamp;
    updatedBy?: string;
}

export const HR_SETTINGS_DEFAULTS: Omit<HrSettings, 'id' | 'updatedAt' | 'updatedBy'> = {
    payrollCycle: 'calendar',
    paydayRule: 'last_working_day',
    graceMinutes: 15,
    lateFineMode: 'proportional',
    halfDayThresholdHours: 4,
    overtimeAfterHours: 8,
    overtimeRateMultiplier: 1.5,
    pfApplicable: false,
    esiApplicable: false,
    ptApplicable: false,
    lwfApplicable: false,
    wageRuleEnforcement: 'warn',
    pfWageCapEnabled: true,
    esiWageCeiling: 21000,
    geofenceEnabled: true,
    geofenceRadiusMeters: 100,
    earnedWageEnabled: false,
    earnedWageMaxPercent: 40,
    earnedWageMinDaysWorked: 10,
};

// ─── Employee Details (HR extension of acc_parties employee) ─────────────────
// Stored in hr_employee_details/{acc_parties_doc_id}
// The base record (name, partyCode, department, designation, phone, email,
// pan, uan, esicNumber, bankName, accountNumber, ifscCode, salaryGlCode)
// stays in acc_parties. This doc holds HR-specific fields.

export type EmploymentType = 'full_time' | 'part_time' | 'contract' | 'intern' | 'daily_wage';
export type EmployeeStatus  = 'active' | 'inactive' | 'on_notice' | 'absconded';
export type WeekDay = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';
export type TaxRegime = 'old' | 'new';

export interface HrEmployeeDetails {
    id?: string;                        // = acc_parties doc ID (same Firestore document ID)
    partyId: string;                    // Explicit link → acc_parties document ID

    // Personal
    dateOfBirth?: Timestamp;
    gender?: 'male' | 'female' | 'other';
    photo?: string;                     // Firebase Storage URL
    aadhaarLast4?: string;              // Only last 4 digits stored

    // Address
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    pincode?: string;

    // Employment
    employmentType: EmploymentType;
    status: EmployeeStatus;
    dateOfJoining: Timestamp;
    dateOfConfirmation?: Timestamp;
    probationMonths: number;
    dateOfExit?: Timestamp;
    exitReason?: string;

    // Reporting
    reportingManagerPartyId?: string;   // → acc_parties EMP/*
    branchId?: string;

    // Work schedule
    shiftId?: string;                   // → hr_shifts
    weeklyOff: WeekDay[];

    // Payroll config
    salaryStructureId?: string;         // → hr_salary_structures
    ctc?: number;                       // Annual CTC in ₹
    effectiveSalaryDate?: Timestamp;
    taxRegime: TaxRegime;
    ptState?: string;                   // May differ from company's primary PT state
    upiId?: string;                     // For RazorpayX UPI payout

    // Onboarding
    faceEmbedding?: number[];           // MediaPipe face descriptor (not reversible image)
    contractDocUrl?: string;            // Signed employment contract in Firebase Storage
    onboardingComplete: boolean;

    createdAt?: Timestamp;
    updatedAt?: Timestamp;
    createdBy?: string;
}

// ─── HR GL Account Seeds ──────────────────────────────────────────────────────
// These are added to acc_glAccounts during HR module bootstrap

export interface HrGlSeed {
    glCode: string;
    description: string;
    accountGroup: string;
    accountType: 'balance_sheet' | 'profit_loss';
    normalBalance: 'debit' | 'credit';
    isControlAccount: boolean;
}

export const HR_GL_SEEDS: HrGlSeed[] = [
    // Current Liabilities — HR payroll payables
    { glCode: '220100', description: 'Salary Payable',                  accountGroup: 'liabilities_current', accountType: 'balance_sheet', normalBalance: 'credit', isControlAccount: false },
    { glCode: '220110', description: 'PF Payable',                      accountGroup: 'liabilities_current', accountType: 'balance_sheet', normalBalance: 'credit', isControlAccount: false },
    { glCode: '220120', description: 'ESI Payable',                     accountGroup: 'liabilities_current', accountType: 'balance_sheet', normalBalance: 'credit', isControlAccount: false },
    { glCode: '220130', description: 'Professional Tax Payable',        accountGroup: 'liabilities_current', accountType: 'balance_sheet', normalBalance: 'credit', isControlAccount: false },
    { glCode: '220140', description: 'TDS on Salary Payable (u/s 192)',  accountGroup: 'liabilities_current', accountType: 'balance_sheet', normalBalance: 'credit', isControlAccount: false },
    { glCode: '220150', description: 'Labour Welfare Fund Payable',     accountGroup: 'liabilities_current', accountType: 'balance_sheet', normalBalance: 'credit', isControlAccount: false },

    // Current Assets — staff loans & advances
    { glCode: '130020', description: 'Loans & Advances to Staff',       accountGroup: 'assets_current', accountType: 'balance_sheet', normalBalance: 'debit', isControlAccount: false },

    // Indirect Expenses — payroll costs
    { glCode: '420020', description: 'PF Employer Contribution',        accountGroup: 'expenses_indirect', accountType: 'profit_loss', normalBalance: 'debit', isControlAccount: false },
    { glCode: '420030', description: 'ESI Employer Contribution',       accountGroup: 'expenses_indirect', accountType: 'profit_loss', normalBalance: 'debit', isControlAccount: false },
    { glCode: '420040', description: 'Staff Welfare & Benefits',        accountGroup: 'expenses_indirect', accountType: 'profit_loss', normalBalance: 'debit', isControlAccount: false },
    { glCode: '420050', description: 'OT, Bonus & Incentive Expense',   accountGroup: 'expenses_indirect', accountType: 'profit_loss', normalBalance: 'debit', isControlAccount: false },
];

// ─── HR Statutory Seed Addition ───────────────────────────────────────────────
// STA/0015 to be seeded alongside existing 14 statutory parties

export const HR_STATUTORY_SEED_ADDITION = {
    partyCode: 'STA/0015',
    partyType: 'statutory' as const,
    name: 'TDS u/s 192 — Salary',
    isActive: true,
    authorityType: 'tds' as const,
    glCode: '220140',
    returnFrequency: 'monthly' as const,
    dueDateDay: 7,
};

// GL codes to update on existing statutory seed entries (STA/0009–0014)
// Used by the bootstrap script / settings panel to patch empty glCode fields
export const HR_STATUTORY_GL_UPDATES: Record<string, string> = {
    'STA/0009': '220110', // PF — Employee Contribution
    'STA/0010': '220110', // PF — Employer Contribution
    'STA/0011': '220110', // PF — Admin Charges
    'STA/0012': '220120', // ESI — Employee Contribution
    'STA/0013': '220120', // ESI — Employer Contribution
    'STA/0014': '220130', // Professional Tax
};

// ─── PT State Slabs (India 2026) ──────────────────────────────────────────────

export interface PtSlab {
    minSalary: number;
    maxSalary: number | null; // null = no upper limit
    monthlyPt: number;
    months?: number[];         // specific months (e.g. Maharashtra: PT in 11 months)
}

export const PT_SLABS: Record<string, PtSlab[]> = {
    MH: [ // Maharashtra
        { minSalary: 0,      maxSalary: 7499,  monthlyPt: 0 },
        { minSalary: 7500,   maxSalary: 9999,  monthlyPt: 175, months: [1,2,3,4,5,6,7,8,9,10,11] },
        { minSalary: 10000,  maxSalary: null,  monthlyPt: 200, months: [1,2,3,4,5,6,7,8,9,10,11] },
        // Feb = 300 for ≥10000 (handled specially)
    ],
    KA: [ // Karnataka
        { minSalary: 0,      maxSalary: 14999, monthlyPt: 0 },
        { minSalary: 15000,  maxSalary: 29999, monthlyPt: 150 },
        { minSalary: 30000,  maxSalary: null,  monthlyPt: 200 },
    ],
    WB: [ // West Bengal
        { minSalary: 0,      maxSalary: 8499,  monthlyPt: 0 },
        { minSalary: 8500,   maxSalary: 9999,  monthlyPt: 90 },
        { minSalary: 10000,  maxSalary: 14999, monthlyPt: 110 },
        { minSalary: 15000,  maxSalary: 24999, monthlyPt: 130 },
        { minSalary: 25000,  maxSalary: 39999, monthlyPt: 150 },
        { minSalary: 40000,  maxSalary: null,  monthlyPt: 200 },
    ],
    AP: [ // Andhra Pradesh
        { minSalary: 0,      maxSalary: 14999, monthlyPt: 0 },
        { minSalary: 15000,  maxSalary: 19999, monthlyPt: 150 },
        { minSalary: 20000,  maxSalary: null,  monthlyPt: 200 },
    ],
    TN: [ // Tamil Nadu
        { minSalary: 0,      maxSalary: 20999, monthlyPt: 0 },
        { minSalary: 21000,  maxSalary: null,  monthlyPt: 208 },
    ],
    GJ: [ // Gujarat
        { minSalary: 0,      maxSalary: 5999,  monthlyPt: 0 },
        { minSalary: 6000,   maxSalary: 8999,  monthlyPt: 80 },
        { minSalary: 9000,   maxSalary: 11999, monthlyPt: 150 },
        { minSalary: 12000,  maxSalary: null,  monthlyPt: 200 },
    ],
    MP: [ // Madhya Pradesh
        { minSalary: 0,      maxSalary: 14999, monthlyPt: 0 },
        { minSalary: 15000,  maxSalary: null,  monthlyPt: 208 },
    ],
    TS: [ // Telangana
        { minSalary: 0,      maxSalary: 14999, monthlyPt: 0 },
        { minSalary: 15000,  maxSalary: 19999, monthlyPt: 150 },
        { minSalary: 20000,  maxSalary: null,  monthlyPt: 200 },
    ],
};

export const PT_STATE_LABELS: Record<string, string> = {
    MH: 'Maharashtra',
    KA: 'Karnataka',
    WB: 'West Bengal',
    AP: 'Andhra Pradesh',
    TN: 'Tamil Nadu',
    GJ: 'Gujarat',
    MP: 'Madhya Pradesh',
    TS: 'Telangana',
    // Add more as needed
};

// ─── India Payroll Constants (2026) ───────────────────────────────────────────

export const INDIA_PAYROLL = {
    PF_RATE_EMPLOYEE: 0.12,
    PF_RATE_EMPLOYER_EPF: 0.0367,  // 3.67% to EPF
    PF_RATE_EMPLOYER_EPS: 0.0833,  // 8.33% to EPS (capped at ₹1,250/month)
    PF_ADMIN_CHARGE: 0.005,        // 0.5% on PF wages
    PF_EDLI_CHARGE: 0.0005,        // 0.05% EDLI
    PF_WAGE_CAP: 15000,            // Monthly PF wage cap (₹15,000)
    ESI_RATE_EMPLOYEE: 0.0075,     // 0.75%
    ESI_RATE_EMPLOYER: 0.0325,     // 3.25%
    ESI_WAGE_CEILING: 21000,       // Monthly gross ceiling for ESI
    GRATUITY_RATE: 0.0481,         // 4.81% of basic (provision)
    GRATUITY_ELIGIBILITY_YEARS: 5,
    GRATUITY_MAX: 2000000,         // ₹20 lakhs cap (2026)
    MINIMUM_WAGE_RULE_BASIC_PERCENT: 0.50, // Basic must be ≥50% of gross (India 2026)
} as const;
