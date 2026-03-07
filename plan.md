# HR Payroll Module — Phase-wise Development Plan (India 2026)

> Extension of Novota (Invoice Digitizer) App
> Indian SMB Market — PagarBook Feature Parity + 2026 Smart Layer
> Stack: React + Vite + Tailwind CSS + Firebase + FastAPI + Capacitor
> Target: Web App + Android APK + iOS IPA (single codebase)

---

## Novota Deep Integration Architecture

This is the most critical design decision. The HR module is NOT a standalone silo —
it is deeply integrated with Novota's existing Accounts and Masters modules.

### Shared Data — Do NOT Duplicate

| Data | Existing Location | HR Strategy |
|---|---|---|
| Employee basic record | `acc_parties` (`partyType: 'employee'`) | **Extend in-place** — HR adds fields to same doc |
| Employee code (EMP/0001) | `acc_parties.partyCode` | Reuse as HR employee identifier |
| Salary GL mapping | `acc_parties.salaryGlCode` | Already on employee — HR payroll uses this directly |
| Bank details | `acc_parties` (bankName, accountNumber, ifscCode) | Already stored — HR payroll reads for RazorpayX |
| PAN, UAN, ESIC number | `acc_parties` (pan, uan, esicNumber) | Already stored |
| Department master | `companies/{id}/departments` (from MMS) | **Shared collection** — HR reads same depts |
| Department cost centre | `Department.costCenterGlCode` | HR payroll uses for dept-wise GL posting |
| Statutory authorities | `acc_parties` (`partyType: 'statutory'`) | **PF (STA/0009-0011), ESI (STA/0012-0013), PT (STA/0014) already seeded** |
| Statutory GL codes | `AccParty.glCode` on statutory parties | HR payroll posts liabilities to these codes |
| GL Chart of Accounts | `acc_glAccounts` | HR adds new accounts; existing ones reused |
| GL Journal | `acc_documents` + `acc_glEntries` | HR adds new `AccDocumentType: 'PR'` and `'PZ'` |
| Fiscal Year / Period | Existing acc infra | Payroll posts to correct period |

### New Data — HR-Only Collections

| Collection | Purpose |
|---|---|
| `hr_employee_details` | Extended HR profile (DOB, DOJ, shift, leave config, face descriptor, photo) — keyed by same `acc_parties` doc ID |
| `hr_attendance` | Daily attendance records |
| `hr_trip_logs` | GPS conveyance trip waypoints |
| `hr_leaves` | Leave applications |
| `hr_leave_balances` | Per-employee leave balance ledger |
| `hr_leave_types` | CL/SL/EL/ML config |
| `hr_shifts` | Shift definitions |
| `hr_shift_roster` | Monthly roster schedule |
| `hr_holidays` | Holiday calendar |
| `hr_salary_components` | Earning/deduction definitions |
| `hr_salary_structures` | Salary templates |
| `hr_payroll_runs` | Monthly batch status tracker |
| `hr_payslips` | Per-employee per-month payslip data |
| `hr_earned_wage_requests` | On-demand pay requests |
| `hr_advances` | Salary advances / loans ledger |
| `hr_expenses` | Expense claims |
| `hr_investment_decl` | 80C/80D/HRA declarations |
| `hr_contracts` | AI-generated employment contracts |
| `hr_messages` + `hr_threads` | Messenger |
| `hr_tasks` | Tasks (linked to messages, with incentives) |
| `hr_announcements` | Noticeboard |
| `hr_statutory_filings` | Filing records (ECR, challan refs) |
| `hr_payout_batches` | RazorpayX batch records |

### GL Posting Flow (Payroll → Accounts)

When a payroll run is approved, HR auto-creates an `AccDocument` of type `PR`:

```
PAYROLL RUN (PR/FY2526/0001) — March 2025 Payroll
─────────────────────────────────────────────────────
Dr  Salary Expense — Basic       (employee.salaryGlCode)   ← already on acc_parties
Dr  HRA Expense                  (component GL)
Dr  PF Employer Expense          (new GL: 420020)
Dr  ESI Employer Expense         (new GL: 420030)
─────────────────────────────────────────────────────
Cr  PF Employee Payable          (STA/0009.glCode)         ← already seeded in statutory
Cr  PF Employer Payable          (STA/0010.glCode)         ← already seeded
Cr  ESI Employee Payable         (STA/0012.glCode)         ← already seeded
Cr  ESI Employer Payable         (STA/0013.glCode)         ← already seeded
Cr  Professional Tax Payable     (STA/0014.glCode)         ← already seeded
Cr  TDS on Salary Payable        (STA/NEW.glCode)          ← add TDS u/s 192
Cr  Salary Payable               (new GL: 220100)
─────────────────────────────────────────────────────

PAYROLL SETTLEMENT (PZ/FY2526/0001) — Bank Payment
─────────────────────────────────────────────────────
Dr  Salary Payable               (220100)
Cr  Bank Account                 (existing Bank GL)
─────────────────────────────────────────────────────
```

Cost centre split: each Dr line tagged with `Department.costCenterGlCode` for dept-wise P&L.

### New AccDocumentTypes to Add

```typescript
// In acc.ts — extend AccDocumentType:
| 'PR'   // Payroll Run (salary provision)
| 'PZ'   // Payroll Settlement (bank disbursement)
| 'HA'   // HR Advance disbursement
| 'HE'   // HR Expense reimbursement
```

### New GL Accounts to Seed

```
220100  Salary Payable                  — Current Liability
220110  PF Payable (Employee + Employer) — Current Liability  (link: STA/0009,0010)
220120  ESI Payable (Employee + Employer)— Current Liability  (link: STA/0012,0013)
220130  Professional Tax Payable        — Current Liability   (link: STA/0014)
220140  TDS on Salary Payable           — Current Liability   (link: STA/NEW)
220150  Advance from Employees Payable  — Current Liability

420010  Salary & Wages — Basic          — Indirect Expense    (if not already)
420020  PF Employer Contribution        — Indirect Expense
420030  ESI Employer Contribution       — Indirect Expense
420040  Staff Welfare & Benefits        — Indirect Expense
420050  OT & Bonus Expense              — Indirect Expense
```

### New Statutory Party to Add

```typescript
// Seed alongside existing 14:
{ partyCode: 'STA/0015', partyType: 'statutory', name: 'TDS u/s 192 — Salary',
  authorityType: 'tds', glCode: '220140', returnFrequency: 'monthly', dueDateDay: 7 }
```

### View Integration Points

| Novota Screen | HR Integration |
|---|---|
| Accounts > Party Master > Employees | Shows HR-enriched data (DOJ, dept, shift, status) |
| Accounts > GL Journal | Payroll runs appear as PR/PZ documents |
| Accounts > Reports | Salary cost in P&L, Salary Payable in Balance Sheet |
| Accounts > Payables | PF/ESI/PT payables tracked via statutory parties |
| Masters > Employees | Deep-links to HR profile (attendance, payslip, leaves) |
| Masters > Departments | Shared — HR reads same dept list |
| Masters > Statutory | PF/ESI/PT due dates + filing status from HR module |

---

## Tech Stack

| Layer | Technology | Rationale |
|---|---|---|
| Frontend | React 18 + Vite + Tailwind CSS | Existing Novota stack |
| Mobile | Capacitor.js v6 | Single codebase → Android + iOS + PWA |
| Backend | FastAPI (Python) | Existing — add `/hr/*` routers |
| Database | Firebase Firestore | Multi-tenant, existing infra |
| Auth | Firebase Auth | Existing roles extended for HR |
| File Storage | Firebase Storage | Payslips, contracts, ID documents |
| Push | Firebase Cloud Messaging | Attendance alerts, payslip ready |
| Real-time Chat | Firestore `onSnapshot` + FCM | WhatsApp-style messenger |
| Video Calls | WebRTC (PeerJS) | P2P, zero server cost |
| AI | Gemini 2.5 Flash (existing pipeline) | Liveness, OCR, contracts, anomaly |
| Face Recognition | MediaPipe Face Mesh | On-device, zero API cost |
| GPS | Capacitor Geolocation + Background Runner | Attendance, conveyance |
| Payments | RazorpayX Payout API | One-click bulk salary disbursement |
| PDF | WeasyPrint (backend) | Payslips, Form 16, contracts |
| OCR | Gemini Vision | ID card scanning, expense receipts |
| WhatsApp | Meta Cloud API | Payslip links, leave approvals |
| SMS | Fast2SMS | OTPs, fallback notifications |

---

## Module Structure

```
src/modules/hr/
  pages/
    HRModule.tsx             — lazy-loaded sub-router
    HRDashboard.tsx          — role-aware landing
  panels/
    EmployeePanel.tsx        — extends Masters > Employees (shared view)
    AttendancePanel.tsx
    LeavePanel.tsx
    PayrollPanel.tsx
    CompliancePanel.tsx      — PF/ESI/PT using existing statutory parties
    ExpensePanel.tsx
    AdvancePanel.tsx
    MessengerPanel.tsx
    TaskPanel.tsx
    ReportsPanel.tsx
    HRSettingsPanel.tsx
  components/
    PunchScreen.tsx          — mobile punch with selfie + GPS
    FaceLiveness.tsx         — MediaPipe on-device liveness
    PayslipViewer.tsx        — interactive (tap to explain each line)
    ShiftRoster.tsx
    ConveyanceMap.tsx
  types/hr.ts                — HR-specific interfaces (extends AccParty)
  lib/
    payroll-engine.ts        — calculations (LOP, OT, TDS, PF, ESI, PT)
    statutory-india.ts       — 2026 India rules
    gl-posting.ts            — build AccDocument entries for payroll
    liveness.ts              — MediaPipe wrapper
    conveyance.ts            — Haversine calculator

backend/hr/
  routes/
    employees.py             — extend acc_parties employee records
    attendance.py
    payroll.py               — run calculation + trigger GL posting
    compliance.py
    contracts.py
    reports.py
  agents/
    contract_agent.py        — Gemini: generate employment contracts
    ocr_id_agent.py          — Gemini Vision: scan Aadhaar/DL
    anomaly_agent.py         — payroll anomaly detection
    attrition_agent.py       — attrition risk scoring
    cashflow_agent.py        — cash flow forecast
    compliance_alert_agent.py
  utils/
    pdf_generator.py
    ecr_generator.py         — EPFO ECR file
    razorpayx.py
    statutory.py
    gl_posting.py            — create AccDocument for payroll in Firestore
```

---

## Phase 1 — Foundation, Shared Data Bootstrap & Mobile Shell

**Goal:** Scaffold HR, configure shared collections, Capacitor setup

### 1.1 Shared Data Audit & Extension

**Accounts > Statutory Master — add GL codes to PF/ESI/PT entries:**
- [ ] Update STA/0009 (PF Emp): `glCode: '220110'`
- [ ] Update STA/0010 (PF Employer): `glCode: '220110'`
- [ ] Update STA/0011 (PF Admin): `glCode: '220110'`
- [ ] Update STA/0012 (ESI Emp): `glCode: '220120'`
- [ ] Update STA/0013 (ESI Employer): `glCode: '220120'`
- [ ] Update STA/0014 (PT): `glCode: '220130'`
- [ ] Seed STA/0015: `TDS u/s 192 — Salary`, `glCode: '220140'`

**Chart of Accounts — seed new GL accounts:**
- [ ] 220100 Salary Payable (Current Liability)
- [ ] 220110 PF Payable (Current Liability)
- [ ] 220120 ESI Payable (Current Liability)
- [ ] 220130 Professional Tax Payable (Current Liability)
- [ ] 220140 TDS on Salary Payable (Current Liability)
- [ ] 420020 PF Employer Contribution Expense (Indirect Expense)
- [ ] 420030 ESI Employer Contribution Expense (Indirect Expense)
- [ ] 420040 Staff Welfare (Indirect Expense)
- [ ] 420050 OT & Bonus Expense (Indirect Expense)

**AccDocumentType extension (`acc.ts`):**
- [ ] Add `'PR'` (Payroll Run), `'PZ'` (Payroll Settlement), `'HA'` (HR Advance), `'HE'` (HR Expense)
- [ ] Add labels + colours for these types

### 1.2 Mobile & PWA Setup
- [ ] Install Capacitor v6, init with `com.novota.hr`
- [ ] Add Android + iOS platforms
- [ ] Capacitor plugins: Geolocation, Camera, PushNotifications, LocalNotifications, Network, Preferences, Filesystem, Haptics, Share, BackgroundRunner, BiometricAuth
- [ ] `vite-plugin-pwa`: manifest, service worker, offline cache
- [ ] App icons + splash screens

### 1.3 Navigation & Routing
- [ ] Add "HR & Payroll" to Novota top nav (alongside MMS, Sales Queue, Accounts, Masters)
- [ ] `HRModule.tsx` — lazy-loaded sub-router
- [ ] Mobile bottom tab bar (Home / Attendance / Leaves / Payslips / More)
- [ ] Role-aware landing: `hr_admin` → dashboard, `employee` → punch screen
- [ ] Deep links: `novota://hr/payslip/2025-03`, `novota://hr/leave/approve/xyz`

### 1.4 Role Extensions
- Add Firebase custom claims: `hr_admin`, `hr_manager`, `employee`, `hr_readonly`
- Update `AuthContext.tsx`
- Firestore Security Rules for all `hr_*` collections

### 1.5 HR Settings
- [ ] `HRSettingsPanel` — company statutory numbers (PF reg, ESI code, TAN)
- [ ] Payroll cycle (1st-last vs 26th-25th), payday config
- [ ] Grace period, late-fine rules, geo-fence radius per branch
- [ ] OT rate multiplier (1.5× / 2×), 50% Wage Rule enforcement toggle
- [ ] RazorpayX API key configuration
- [ ] WhatsApp Business number setup

### 1.6 Backend Foundation
- [ ] `backend/hr/` FastAPI router, mount at `/hr` in `main.py`
- [ ] Reuse Firebase Admin SDK
- [ ] Install: `weasyprint`, `openpyxl`, `razorpay`, `pandas`

**Deliverable:** Shared GL/statutory data ready, HR scaffold wired to existing Novota nav, Capacitor configured.

---

## Phase 2 — Employee Master: Extend, Don't Duplicate

**Goal:** HR enriches `acc_parties` employee records — same record, more data

### 2.1 Architecture Decision
```
acc_parties/{docId}                  ← Single source of truth (existing)
  partyType: 'employee'
  partyCode: 'EMP/0001'
  name, employeeCode, department, designation
  phone, email, pan, uan, esicNumber
  bankName, accountNumber, ifscCode
  salaryGlCode                       ← GL for salary expense (already exists!)

hr_employee_details/{same docId}     ← HR extension (new, same ID as acc_parties doc)
  partyId: same acc_parties doc ID   ← explicit link
  dateOfBirth, gender, photo
  dateOfJoining, dateOfConfirmation, dateOfExit
  employmentType, probationMonths, status
  reportingManagerId (→ acc_parties EMP)
  shiftId, weeklyOff[]
  taxRegime: 'old' | 'new'
  uanNumber, ptState
  faceEmbedding[]                    ← MediaPipe descriptor
  upiId                              ← for RazorpayX UPI payout
  contractDocUrl                     ← signed employment contract
```

**Why this structure:** Masters > Employees panel continues working unchanged.
HR module reads `acc_parties` (base) + `hr_employee_details` (extension) — merged in frontend.
Payroll GL posting uses `acc_parties.salaryGlCode` directly. No migration needed.

### 2.2 EmployeeMasterPanel Enhancement
- [ ] Extend existing [EmployeeMasterPanel.tsx](src/components/masters/EmployeeMasterPanel.tsx):
  - Add "HR Profile" tab next to existing fields
  - HR tab: DOB, DOJ, employment type, shift assignment, tax regime, photo
  - "View HR Profile" button → opens full HR profile page
- [ ] HR profile page shows: attendance summary, leave balances, payslip history, advances, tasks

### 2.3 AI-Powered Onboarding (10-Second Enroll)
- [ ] **OCR ID Scanner** (`ocr_id_agent.py`):
  - Capacitor Camera → capture Aadhaar / PAN / Driving Licence
  - Gemini Vision extracts: name, DOB, gender, ID number, address
  - Auto-fills `acc_parties` fields (PAN, name) + `hr_employee_details` (DOB, address)
  - Validates PAN format (AAAAA9999A), Aadhaar checksum
- [ ] **Face Enrollment**: selfie → MediaPipe descriptor → stored in `hr_employee_details.faceEmbedding`
- [ ] **AI Contract Architect** (`contract_agent.py`):
  - Reads designation, salary, DOJ, notice period from employee record
  - Gemini generates offer letter / employment contract (2026 Labour Law compliant)
  - Stores draft in `hr_contracts/{employeeId}`
- [ ] **Digital E-Signature**: OTP-verified sign → PDF stored in Firebase Storage → URL on `hr_employee_details.contractDocUrl`

### 2.4 Department Master (Shared)
- [ ] HR reads from the **same `departments` Firestore collection** as MMS — no new collection
- [ ] [DepartmentMasterPanel.tsx](src/components/masters/DepartmentMasterPanel.tsx) already has `costCenterGlCode` — HR uses this for payroll GL posting
- [ ] Add HR-specific fields to `Department`: `hrManagerId` (→ employee for leave approvals)
- [ ] Extend `DepartmentType` enum for non-F&B businesses (admin, finance, IT, etc.)

### 2.5 Org Chart & Directory
- [ ] Visual org chart using `react-organizational-chart` (reads `hr_employee_details.reportingManagerId`)
- [ ] Employee directory: photo, name, designation, dept, phone
- [ ] Bulk import: Excel template (name, emp code, dept, designation, phone, email, PAN, UAN, bank)

**Deliverable:** Employee master extended in-place, AI onboarding, OCR scan, contracts, shared departments.

---

## Phase 3 — Attendance & Time Tracking

**Goal:** Selfie + GPS + Liveness AI + Geo-fence — zero API cost

### 3.1 Attendance Data Model
```typescript
interface HrAttendance {
  id: string
  employeeId: string            // = acc_parties doc ID
  date: string                  // YYYY-MM-DD
  status: 'present' | 'absent' | 'half_day' | 'week_off' | 'holiday' | 'on_leave' | 'paid_leave'
  punchIn?: Timestamp; punchOut?: Timestamp
  punchInLocation?: { lat: number; lng: number }
  punchOutLocation?: { lat: number; lng: number }
  punchInSelfie?: string        // Firebase Storage URL
  livenessScore?: number        // 0-1, MediaPipe
  faceMatchScore?: number       // vs hr_employee_details.faceEmbedding
  isWithinGeofence?: boolean
  distanceFromOfficeMeters?: number
  workingMinutes?: number; overtimeMinutes?: number
  lateByMinutes?: number; earlyByMinutes?: number
  isRegularized: boolean; regularizedBy?: string
  shiftId: string
}
```

### 3.2 Face Liveness AI (On-Device, Zero Cost)
- [ ] `FaceLiveness.tsx` — MediaPipe Face Mesh (runs in browser / WKWebView on iOS)
- [ ] Anti-spoofing challenges: blink detection, head-turn prompt (random), depth via Z-axis
- [ ] After liveness pass → compare with `hr_employee_details.faceEmbedding`
- [ ] `faceMatchScore >= 0.75` required to mark present
- [ ] Fallback: manager manual regularization

### 3.3 GPS Geo-fence
- [ ] Capacitor Geolocation on punch
- [ ] Haversine distance from `HRSettings.branchCoordinates` (per branch)
- [ ] Configurable fence radius (default 100m)
- [ ] Outside fence → flag + optional manager approval
- [ ] Map: Leaflet.js (no Google Maps cost)

### 3.4 Punch Screen (Mobile-First)
- [ ] Default landing for `employee` role on mobile
- [ ] Flow: liveness check → selfie → GPS → submit
- [ ] Shows: current time, shift info, today's punches, hours worked
- [ ] **Offline Queue**: Capacitor Preferences — save punch with timestamp+GPS when offline
- [ ] **Auto-sync**: on network reconnect, flush queue → toast "2 punches synced"
- [ ] Haptic feedback on success

### 3.5 Admin Attendance Management
- [ ] `AttendancePanel` — monthly calendar per employee
- [ ] Bulk grid: employee × date matrix with colour coding
- [ ] Manual entry, bulk mark, regularization approval
- [ ] Late fine preview (used in payroll: `(lateMin / shiftMin) × dailyRate`)
- [ ] Biometric sync: BioTime/eSSL API polling (backend cron)

### 3.6 Shift Management
- [ ] `hr_shifts` collection: name, startTime, endTime, graceMinutes, OT threshold, break, night allowance
- [ ] Monthly shift roster: drag-and-drop grid
- [ ] Shift swap request → approval flow

### 3.7 Holiday Calendar
- [ ] `hr_holidays` collection: pre-loaded India national + state holidays
- [ ] Company additions, branch-wise (auto-filter by state)

**Deliverable:** Liveness + GPS + selfie attendance, offline-first, shift management, holiday calendar.

---

## Phase 4 — Leave Management

### 4.1 Leave Types (India defaults)
| Code | Name | Days | Paid | Carry Forward |
|---|---|---|---|---|
| CL | Casual Leave | 12 | Yes | No |
| SL | Sick Leave | 12 | Yes | No |
| EL | Earned Leave | 15 | Yes | Yes (max 30) |
| ML | Maternity Leave | 182 | Yes | No |
| PL | Paternity Leave | 15 | Yes | No |
| CO | Comp-Off | Accrual | Yes | 30 days |
| LOP | Loss of Pay | — | No | No |

- [ ] `hr_leave_types` — CRUD, custom types
- [ ] Prorated on joining; monthly accrual cron (backend)
- [ ] Year-end carry forward + lapse

### 4.2 Leave Application
- [ ] Self-apply modal (date picker highlights weekends + `hr_holidays`)
- [ ] Balance check real-time; medical cert upload for SL > 2 days
- [ ] Approval: `Department.hrManagerId` (set in Phase 2) gets FCM + WhatsApp
- [ ] Team leave calendar — shows all leaves in a dept (manager view)
- [ ] LOP: auto-deduct in payroll run for unapproved absent days

### 4.3 Comp-Off Accrual
- [ ] OT attendance records → auto-credit comp-off balance (configurable toggle)
- [ ] Comp-off expiry (e.g. use within 60 days)

**Deliverable:** Leave lifecycle, balance ledger, manager approvals, LOP integration with payroll.

---

## Phase 5 — Salary Structure & 2026 Compliance Engine

**Goal:** 50% Wage Rule, PF/ESI/PT/TDS, investment declarations — India-compliant

### 5.1 Salary Components (Pre-Built)
Uses `acc_glAccounts` GL codes already in Chart of Accounts:

| Component | Type | Calc | GL Code |
|---|---|---|---|
| Basic | Earning | ≥50% of Gross (2026) | `acc_parties.salaryGlCode` |
| HRA | Earning | 40%/50% of Basic | salary GL |
| Transport Allowance | Earning | Fixed | 420010 |
| Special Allowance | Earning | Balance | 420010 |
| Night Shift Allowance | Earning | Fixed | 420040 |
| OT Pay | Earning | Formula | 420050 |
| PF Employee | Deduction | 12% Basic (cap ₹1,800) | 220110 |
| ESI Employee | Deduction | 0.75% Gross (if ≤₹21k) | 220120 |
| Professional Tax | Deduction | State slab | 220130 |
| TDS | Deduction | Monthly installment | 220140 |
| PF Employer | Employer | 12% Basic | 420020 → 220110 |
| ESI Employer | Employer | 3.25% Gross | 420030 → 220120 |

### 5.2 50% Wage Rule (India 2026)
- [ ] Real-time validation: Basic < 50% of CTC → compliance error badge
- [ ] AI auto-restructure: click "Fix Compliance" → Gemini suggests rebalanced structure
- [ ] Shows PF impact: "Higher Basic = Higher PF = ₹X more employer cost/month"
- [ ] Warn vs block mode (configurable in HR Settings)

### 5.3 Salary Structure Templates
- [ ] `hr_salary_structures` — template CRUD (SS/001)
- [ ] Live CTC breakdown: Gross / Employee Deductions / Employer Cost / Net Take-Home
- [ ] Compliance badge: pass/fail for 50% rule, PF ceiling, ESI threshold
- [ ] Assign to employee (`hr_employee_details.salaryStructureId`) with effective date
- [ ] Revision history (full audit trail in `hr_salary_revisions`)
- [ ] AI Salary Suggestions: role + location + industry → Gemini suggests structure

### 5.4 TDS Engine (Section 192, India 2026)
- [ ] Old vs New tax regime per employee (`hr_employee_details.taxRegime`)
- [ ] Investment Declaration Portal: employees upload rent receipts, insurance, NPS docs
  - Gemini Vision verifies uploaded documents vs declared amounts
- [ ] Monthly TDS = (Projected Annual Tax − YTD Deducted) / Remaining Months
- [ ] Mid-year declaration update → TDS recalculated prospectively
- [ ] Form 12BB generation (PDF)

### 5.5 Professional Tax (All 28 States)
- [ ] State slab tables pre-loaded, auto-detect from `hr_employee_details.ptState`
- [ ] Uses STA/0014 (existing statutory party) for GL posting

**Deliverable:** 50% Wage Rule validator, TDS investment portal, PT all states, GL-mapped components.

---

## Phase 6 — Payroll Processing ("Zero-Touch Pay Day")

**Goal:** Calculate → approve → post to GL → generate payslips → bulk pay via RazorpayX

### 6.1 Payroll Run States
```
draft → calculating → review → approved → gl_posted → disbursed → locked
```

### 6.2 Payroll Data Model
```typescript
interface HrPayrollRun {
  id: string                    // PR/2025-03
  month: string                 // "2025-03"
  status: 'draft' | 'calculating' | 'review' | 'approved' | 'gl_posted' | 'disbursed' | 'locked'
  accDocumentId?: string        // → acc_documents (PR type) — created on approval
  payoutBatchId?: string        // → hr_payout_batches (RazorpayX)
  totalGross: number; totalDeductions: number; totalNetPay: number
  totalEmployerPF: number; totalEmployerESI: number
  totalTDS: number; totalPT: number
  approvedBy?: string; lockedAt?: Timestamp
}

interface HrPayslip {
  id: string
  payrollRunId: string; employeeId: string  // employeeId = acc_parties doc ID
  month: string
  workingDays: number; presentDays: number; lopDays: number
  overtimeHours: number; lateFineMinutes: number
  earnings: ComponentAmount[]; deductions: ComponentAmount[]
  employerContributions: ComponentAmount[]
  grossEarnings: number; totalDeductions: number; netPay: number
  ytdGross: number; ytdTDS: number; ytdPF: number
  advanceRecovery: number; earnedWageDeduction: number
  salaryGlCode: string          // snapshot from acc_parties.salaryGlCode at run time
  departmentCostCentre: string  // snapshot from Department.costCenterGlCode
  status: 'draft' | 'approved' | 'paid'
  pdfUrl?: string
}
```

### 6.3 Payroll Calculation Engine

**Step-by-step (backend `/hr/payroll/run`):**
1. Fetch `acc_parties` (bank, salaryGlCode) + `hr_employee_details` (shift, structure, tax regime)
2. Fetch `hr_attendance` for month → present, LOP, OT, late fine minutes
3. Prorate: joiners/exiters → (present / working days) × monthly gross
4. **Validate 50% Wage Rule** → flag violations (don't block, just warn)
5. Calculate OT: `OT hours × (Basic / 26 / 8) × multiplier`
6. Late fine: `(lateMin / shiftMin) × dailyRate`
7. PF: 12% of Basic (employee + employer), cap ₹1,800 employee share
8. ESI: employee 0.75% + employer 3.25% (only if gross ≤ ₹21,000)
9. PT: state-wise slab (from `hr_employee_details.ptState`)
10. TDS u/s 192: monthly installment from annual computation
11. Deduct advances (EMI from `hr_advances.recoverySchedule`)
12. Deduct earned-wage advances taken this month
13. Write each payslip to `hr_payslips`

### 6.4 GL Auto-Posting (on Approval)
- [ ] `gl_posting.py` / `gl-posting.ts` builds `AccDocument` (type `PR`) with `acc_glEntries`
- [ ] Each earning Dr line tagged with `departmentCostCentre` (from Department)
- [ ] PF/ESI/PT/TDS Cr lines use GL codes from existing statutory parties (STA/0009-0014)
- [ ] `accDocumentId` stored back on `HrPayrollRun`
- [ ] Document visible in Accounts > GL Journal as `PR/FY2526/0001`

### 6.5 Payroll UI
- [ ] `PayrollPanel` — list of monthly runs with status pipeline
- [ ] Initialize Run → calculate → review screen:
  - Summary cards: Payable, PF Liability, ESI Liability, TDS, Employer Cost
  - Employee table with drill-down, variance alerts (>20% change)
  - Anomaly flags from `anomaly_agent.py`
  - Override individual amounts, add ad-hoc bonus/deduction
- [ ] "Approve & Post to GL" button — creates AccDocument + updates GL
- [ ] Real-time calculation progress (Firestore `onSnapshot`)

### 6.6 Interactive Payslip Viewer
- [ ] `PayslipViewer.tsx` — not just a PDF
- [ ] Tap any line → tooltip explains it:
  - "Basic Salary: ₹15,000 — must be ≥50% of gross per 2026 rule"
  - "PF Deduction: Your ₹1,800 + Company adds ₹1,800 = ₹3,600 goes to your EPF account"
  - "TDS: Projected ₹84,000 annual tax ÷ 12 months = ₹7,000/month"
  - "LOP: 3 absent days × ₹500/day (₹15,000 ÷ 30) = ₹1,500"
  - "Advance Recovery: ₹2,000 of ₹10,000 loan (5 months remaining)"
- [ ] FCM + WhatsApp when payslip available
- [ ] Download PDF (Capacitor Filesystem on mobile) / Share

### 6.7 One-Click Bulk Payout (RazorpayX)
- [ ] Read `acc_parties.accountNumber` + `acc_parties.ifscCode` (already stored!)
- [ ] Or read `hr_employee_details.upiId` for UPI payout
- [ ] Build RazorpayX payout batch → `hr_payout_batches`
- [ ] Owner approves → POST to RazorpayX bulk payout API
- [ ] Status webhook → update payslip → FCM + WhatsApp "Salary Credited to your account"
- [ ] Settlement: auto-create `AccDocument` type `PZ` (Dr Salary Payable / Cr Bank)
- [ ] Fallback: download NEFT file (bank account data from `acc_parties`)

### 6.8 Instant F&F Settlement (2026 — 2 Working Days Law)
- [ ] "Exit Mode" on employee profile — set exit date
- [ ] F&F computed in real-time:
  - Pending salary (prorated to exit date)
  - EL balance encashment (days × daily rate)
  - Gratuity (if ≥5 years: `(lastBasic/26) × 15 × years`)
  - Notice pay (served/not served)
  - Deduct outstanding advances from `hr_advances`
- [ ] F&F payslip PDF + GL entry (type `PR` marked as F&F)
- [ ] RazorpayX instant payout
- [ ] AI-generated Relieving Letter + Experience Letter

### 6.9 Earned Wage Access (On-Demand Pay)
- [ ] Employee requests mid-month withdrawal via app
- [ ] App shows: "Earned so far: ₹12,500 — max withdraw: ₹5,000 (40%)"
- [ ] Auto-approval or manager approval (configurable)
- [ ] RazorpayX instant payout → deducted from month-end payslip
- [ ] GL: Dr Salary Payable (advance payment) / Cr Bank

**Deliverable:** Zero-touch payroll → GL auto-post → RazorpayX payout → interactive payslips → F&F in 30s.

---

## Phase 7 — Statutory Compliance & Filings

**Goal:** PF ECR, ESI, PT, TDS/Form 16 — using Novota's existing statutory infrastructure

### 7.1 Integration with Statutory Master
- [ ] `CompliancePanel` reads existing `acc_parties` (partyType: 'statutory')
- [ ] STA/0009-0014 GL codes → payroll liabilities already posted in Phase 6
- [ ] Filing calendar uses `AccParty.dueDateDay` + `returnFrequency` (already on statutory records)
- [ ] Compliance dashboard: "PF due 15th — ₹42,300 pending" — pulled from GL Salary Payable balance

### 7.2 PF (EPFO)
- [ ] Monthly ECR file (`ecr_generator.py`): UAN + contribution per employee
- [ ] ECR reads UAN from `acc_parties.uan` (already stored!)
- [ ] Challan: employee 12% + employer 12% + admin 0.5% + EDLI 0.01%
- [ ] Filing record stored in `hr_statutory_filings`
- [ ] PF payment → `AccDocument` type `KZ` (payment to STA/0009-0011 statutory party)

### 7.3 ESI (ESIC)
- [ ] Monthly ESI statement, challan file
- [ ] ESIC number from `acc_parties.esicNumber` (already stored!)
- [ ] ESI payment → AccDocument (KZ to STA/0012-0013)
- [ ] Half-yearly return data (Form 5)

### 7.4 Professional Tax
- [ ] 28 state slabs pre-loaded
- [ ] PT challan per state per month
- [ ] PT payment → AccDocument (KZ to STA/0014)

### 7.5 TDS — Section 192
- [ ] Monthly TDS ledger per employee
- [ ] 24Q quarterly return data (NSDL format)
- [ ] **Form 16 generation** (Part A + Part B): WeasyPrint PDF
- [ ] Bulk Form 16 WhatsApp/email to all employees
- [ ] TDS payment → AccDocument (KZ to STA/0015)

### 7.6 Compliance AI Agent
- [ ] `compliance_alert_agent.py`: weekly scan for new MoLE/EPFO circulars
- [ ] Alert: "ESIC wage ceiling revised — 3 of your employees now covered"
- [ ] Upcoming due date FCM reminders (uses `AccParty.dueDateDay`)
- [ ] Compliance score (% filings on time — tracked in `hr_statutory_filings`)

### 7.7 Audit-Ready Reports
- [ ] Muster Roll (Form B under Factories Act) — PDF/Excel
- [ ] Wage Register (Form IV under Minimum Wages Act)
- [ ] Salary Register (all payslips in one sheet)
- [ ] All use `acc_parties` employee data as source

**Deliverable:** Full statutory cycle using existing parties, GL codes, document flow — no parallel systems.

---

## Phase 8 — Advances, Loans & Expense Management

### 8.1 Salary Advance / Loan Khata
```typescript
interface HrAdvance {
  id: string                    // ADV/2025-03/001
  employeeId: string            // = acc_parties doc ID
  type: 'advance' | 'loan'
  amount: number
  status: 'pending' | 'approved' | 'disbursed' | 'closed'
  repaymentMonths: number; emiAmount: number
  recoveredAmount: number; outstandingAmount: number
  recoverySchedule: { month: string; amount: number; status: 'pending' | 'recovered' }[]
  accDocumentId?: string        // → AccDocument type 'HA' on disbursement
}
```
- [ ] On disbursement: auto-create `AccDocument` type `HA`:
  - Dr: Loans & Advances to Staff (new GL 130020)
  - Cr: Bank (existing bank GL)
- [ ] On recovery (monthly payroll): Dr Salary Payable / Cr 130020
- [ ] Outstanding balance on `PayslipViewer` (interactive Khata view)
- [ ] RazorpayX payout for disbursement (reads bank details from `acc_parties`)

### 8.2 Expense Claims
- [ ] Mobile receipt capture → Gemini Vision: auto-category + amount extraction
- [ ] Policy limits per category
- [ ] On reimbursement: `AccDocument` type `HE`:
  - Dr: Staff Expenses (420040) / Cr: Bank or Salary Payable
- [ ] Monthly expense report (department-wise, reads `Department.costCenterGlCode`)

**Deliverable:** Advance Khata with GL integration, expense claims with AI receipt scanning.

---

## Phase 9 — Conveyance, Overtime & Field Staff

### 9.1 Auto Conveyance Tracking
- [ ] "Start Trip" → background GPS (Capacitor Background Runner)
- [ ] Waypoints saved on-device; "End Trip" → upload → Haversine distance (zero API cost)
- [ ] `distanceKm × ratePerKm` → reimbursement amount
- [ ] AI route anomaly detection: flag >2× expected distance
- [ ] Approve trip → `AccDocument` type `HE` for reimbursement
- [ ] Leaflet.js map replay (no Google Maps)

### 9.2 Overtime
- [ ] Auto-detected from attendance: hours > shift length
- [ ] OT approval workflow → included in payroll as OT Pay line (GL 420050)
- [ ] Comp-off option: credit `hr_leave_balances` instead of pay

### 9.3 Daily Wage Workers
- [ ] Simple mode: `presentDays × dailyRate` (no complex leave/structure)
- [ ] Weekly/fortnightly cycle; cash payment option
- [ ] Daily wage register (statutory format)

### 9.4 Shift Roster
- [ ] Monthly drag-and-drop roster grid
- [ ] Shift swap requests + approval
- [ ] Night shift allowance auto-added (GL 420040)

**Deliverable:** GPS conveyance (zero API cost), OT in payroll GL, daily wage, shift roster.

---

## Phase 10 — Messenger, Tasks & Announcements

### 10.1 WhatsApp-Style Messenger
- [ ] Real-time chat via Firestore `onSnapshot`
- [ ] DM + group threads (`hr_threads`, `hr_messages`)
- [ ] **Convert to Task**: long-press message → create `hr_tasks` entry with deadline
- [ ] Read receipts, emoji reactions
- [ ] **P2P Video Calls**: WebRTC PeerJS (no server cost)

### 10.2 Task Management + Incentive Linking
```typescript
interface HrTask {
  linkedIncentiveAmount?: number    // bonus if completed on time
  linkedPayrollRunId?: string       // which payroll to add it to
  completedAt?: Timestamp; verifiedBy?: string
}
```
- [ ] Kanban board (Open / In Progress / Done)
- [ ] Task completed + manager verified → bonus auto-added to next payroll run
- [ ] GL: bonus as `HE` document → posted to OT & Bonus Expense (420050)

### 10.3 Announcements
- [ ] Company/branch/dept announcements with FCM push
- [ ] Acknowledgement tracking
- [ ] Auto: Birthday + Work Anniversary messages (from `hr_employee_details.dateOfBirth/dateOfJoining`)

**Deliverable:** Messenger, P2P video, task-linked payroll incentives, announcements.

---

## Phase 11 — HR Operations (Onboarding, Exit, Performance, Documents)

### 11.1 Onboarding Checklist
- [ ] Template per designation → tasks assigned to IT, Admin, HR, Manager
- [ ] Document collection tracker (reads `hr_contracts`, `hr_documents`)
- [ ] Probation alert (15 days before end); confirmation letter (AI-drafted + e-signed)

### 11.2 Exit Management & F&F
(See Phase 6.8 for F&F calculation — cross-linked)
- [ ] Exit interview form, exit checklist (asset return, account deactivation)
- [ ] Deactivates `acc_parties.isActive = false` (same toggle as existing Masters)
- [ ] Attrition analysis: exit reason → feeds `attrition_agent`

### 11.3 Document Management
- [ ] Company repository + employee docs (offer letter, Form 16, PF passbook)
- [ ] Document expiry reminders (visa, contracts)

### 11.4 Performance Management
- [ ] Appraisal cycle (annual/half-yearly), self-assessment, manager rating
- [ ] Rating → salary revision (updates `hr_salary_revisions`, re-runs next payroll)

**Deliverable:** Full lifecycle — onboarding to exit, deactivation synced with acc_parties.

---

## Phase 12 — Reports & AI Analytics

### 12.1 Statutory Reports
Muster Roll, Wage Register, PF ECR, ESI statement, PT challan, 24Q data, Form 16 — all pulling from `acc_parties` + `hr_payslips` + `hr_attendance`.

### 12.2 Business Reports
Payroll summary, salary register, attendance register, late arrival, OT, leave utilisation, advance outstanding, expense by dept, conveyance log, headcount trend.

All department-wise reports cross-reference `Department.costCenterGlCode` for cost mapping.

### 12.3 AI Analytics
- [ ] **Cash Flow Forecast** (`cashflow_agent.py`): next month salary outflow prediction
- [ ] **Attrition Risk** (`attrition_agent.py`): per-employee risk score 0–100, flags to HR admin
- [ ] **Payroll Anomaly** (`anomaly_agent.py`): unusual changes before approval ("same bank account for 3 employees")
- [ ] **Attendance Insight**: weekly manager digest via FCM + WhatsApp

### 12.4 Accounts Module Reports Enhancement
- [ ] Salary Payable on Balance Sheet (GL 220100) — auto from payroll GL posting
- [ ] Staff cost in P&L — Indirect Expenses section (420010-420050)
- [ ] Dept-wise salary cost (cost centre from Department.costCenterGlCode)

**Deliverable:** 20+ reports, AI predictions, salary in P&L/Balance Sheet via existing GL infra.

---

## Phase 13 — Mobile App Production (Android + iOS + PWA)

### 13.1 Mobile UI
- [ ] All screens mobile-first (Tailwind breakpoints)
- [ ] Bottom nav (5 tabs) for `employee` role: Home / Punch / Leaves / Payslip / More
- [ ] Swipe-to-approve on leave/expense cards
- [ ] Pull-to-refresh, skeleton loaders, 44px min touch targets

### 13.2 Offline-First
- [ ] Service Worker: cache app shell + last-seen data
- [ ] Capacitor Preferences: punch queue with timestamp + GPS
- [ ] Auto-sync on reconnect → toast notification
- [ ] Offline read: payslip, leave balance, attendance (last-cached)

### 13.3 Android Build
- [ ] Target SDK 35, `google-services.json`, all permissions
- [ ] Signed AAB for Play Store (with ProGuard)

### 13.4 iOS Build
- [ ] `GoogleService-Info.plist`, all `Info.plist` usage strings
- [ ] Background location mode for trip tracking
- [ ] TestFlight → App Store

### 13.5 PWA
- [ ] Installable on Windows/Mac/Chromebook
- [ ] Web Push for desktop notifications
- [ ] "Add to Home Screen" prompt

### 13.6 Biometric Auth
- [ ] `@capacitor-community/biometric-auth` for sensitive screens (approve payroll, view bank details)

**Deliverable:** Published Android + iOS + PWA from single React codebase.

---

## Implementation Summary

| Phase | Description | Effort |
|---|---|---|
| 1 | Foundation: shared GL/statutory bootstrap, Capacitor, routing | 1 week |
| 2 | Employee master extension, AI OCR onboarding, contracts | 2 weeks |
| 3 | Attendance: liveness AI + GPS geo-fence + offline | 2.5 weeks |
| 4 | Leave management | 1.5 weeks |
| 5 | Salary structure + 50% wage rule + TDS engine | 2 weeks |
| 6 | Payroll: calculation + GL posting + RazorpayX + F&F + on-demand pay | 3 weeks |
| 7 | Statutory compliance (uses existing statutory parties + GL) | 2 weeks |
| 8 | Advances Khata + expense claims | 1 week |
| 9 | Conveyance GPS + OT + daily wage + roster | 1.5 weeks |
| 10 | Messenger + video + tasks + incentives | 2 weeks |
| 11 | HR ops: onboarding, exit, documents, performance | 1.5 weeks |
| 12 | Reports + AI analytics | 2 weeks |
| 13 | Mobile: Android + iOS + PWA production | 2 weeks |
| **Total** | | **~26 weeks** |

**MVP (Phases 1–6, ~12 weeks):** Employees, attendance, leaves, payroll, GL auto-post, payslips, RazorpayX.

---

## Firestore Composite Indexes

```
hr_attendance:           (employeeId ASC, date DESC)
hr_attendance:           (branchId ASC, date ASC, status ASC)
hr_leaves:               (employeeId ASC, status ASC, fromDate ASC)
hr_leaves:               (approverId ASC, status ASC, appliedAt DESC)
hr_payslips:             (payrollRunId ASC, status ASC)
hr_payslips:             (employeeId ASC, month DESC)
hr_advances:             (employeeId ASC, status ASC)
hr_employee_details:     (departmentId ASC, status ASC)
hr_employee_details:     (branchId ASC, status ASC, dateOfJoining ASC)
hr_trip_logs:            (employeeId ASC, date DESC, status ASC)
hr_messages:             (threadId ASC, sentAt ASC)
hr_tasks:                (assigneeId ASC, status ASC, dueDate ASC)
acc_parties:             (partyType ASC, isActive ASC)        ← already needed
```

---

## Security Rules

- `employee` role: read/write own `hr_employee_details`, `hr_attendance`, `hr_leaves`, `hr_payslips`, `hr_advances`, `hr_expenses`, `hr_messages`
- `hr_manager`: read/write team records filtered by `reportingManagerId`
- `hr_admin`: full `hr_*` collections
- `acc_parties` employee records: `hr_admin` can write HR-extended fields; `employee` self read-only
- Payroll runs (`hr_payroll_runs` + GL posting): `hr_admin` only
- `acc_documents` of type PR/PZ: written only by backend service account

---

## PagarBook + 2026 Feature Parity Checklist

| Feature | Phase | Novota Integration |
|---|---|---|
| Employee Master | 2 | Extends `acc_parties` — no duplicate |
| Dept Master | 2 | Shared `departments` collection with MMS |
| Selfie + GPS Attendance | 3 | — |
| Face Liveness AI | 3 | — |
| Geo-fencing | 3 | — |
| Multi-Shift + Roster | 3, 9 | — |
| Auto Salary Calculation | 6 | — |
| GL Auto-Posting | 6 | Uses existing `acc_documents` + `acc_glEntries` |
| Payslip Interactive Viewer | 6 | — |
| RazorpayX One-Click Payout | 6 | Reads bank from `acc_parties` |
| Earned Wage Access | 6 | GL: Dr Salary Payable / Cr Bank |
| Instant F&F | 6 | AccDocument type PR (F&F) |
| PF / ESI / PT / TDS | 5, 7 | Uses STA/0009-0015 statutory parties |
| Statutory GL Posting | 7 | Uses existing `AccParty.glCode` |
| Form 16 Bulk | 7 | — |
| PF ECR File | 7 | Reads UAN from `acc_parties.uan` |
| Advance Khata | 8 | AccDocument type HA, GL 130020 |
| Expense Claims | 8 | AccDocument type HE, dept cost centre |
| GPS Conveyance | 9 | Haversine (zero API cost) |
| OT in Payroll | 9 | GL 420050 |
| Daily Wage | 9 | — |
| AI OCR Onboarding | 2 | — |
| AI Contract Generator | 2 | — |
| Messenger + Video | 10 | — |
| Task-Linked Incentives | 10 | Auto-posted to next payroll run |
| Compliance Alerts | 7 | Uses statutory `dueDateDay` from `acc_parties` |
| Attrition Risk AI | 12 | — |
| Cash Flow Forecast | 12 | — |
| Payroll Anomaly AI | 6, 12 | — |
| Salary in P&L / Balance Sheet | 12 | Automatic via GL posting in Phase 6 |
| Android App | 13 | — |
| iOS App | 13 | — |
| PWA | 13 | — |
| WhatsApp Notifications | All | — |
| Tally GL Sync | Existing | Payroll PR docs → Tally Hub as JV |
