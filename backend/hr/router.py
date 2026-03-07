from fastapi import APIRouter, HTTPException, Query
from firebase_admin import firestore
from google.cloud.firestore_v1 import SERVER_TIMESTAMP
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix='/hr', tags=['HR Payroll'])

# ── Health ────────────────────────────────────────────────────────────────────

@router.get('/health')
def hr_health():
    return {'status': 'ok', 'module': 'hr'}


# ── HR Settings ───────────────────────────────────────────────────────────────

@router.get('/settings/{company_id}')
def get_hr_settings(
    company_id: str,
    branch_id: Optional[str] = Query(None),
):
    db = firestore.client()
    key = branch_id or 'company'
    ref = db.collection('companies').document(company_id).collection('hr_settings').document(key)
    snap = ref.get()
    if not snap.exists:
        return {'exists': False, 'data': None}
    return {'exists': True, 'data': snap.to_dict()}


# ── Bootstrap ─────────────────────────────────────────────────────────────────

HR_GL_SEEDS = [
    {'glCode': '220100', 'description': 'Salary Payable',                 'accountGroup': 'liabilities_current', 'accountType': 'balance_sheet', 'normalBalance': 'credit', 'isControlAccount': False},
    {'glCode': '220110', 'description': 'PF Payable',                     'accountGroup': 'liabilities_current', 'accountType': 'balance_sheet', 'normalBalance': 'credit', 'isControlAccount': False},
    {'glCode': '220120', 'description': 'ESI Payable',                    'accountGroup': 'liabilities_current', 'accountType': 'balance_sheet', 'normalBalance': 'credit', 'isControlAccount': False},
    {'glCode': '220130', 'description': 'Professional Tax Payable',       'accountGroup': 'liabilities_current', 'accountType': 'balance_sheet', 'normalBalance': 'credit', 'isControlAccount': False},
    {'glCode': '220140', 'description': 'TDS on Salary Payable (u/s 192)','accountGroup': 'liabilities_current', 'accountType': 'balance_sheet', 'normalBalance': 'credit', 'isControlAccount': False},
    {'glCode': '220150', 'description': 'Labour Welfare Fund Payable',    'accountGroup': 'liabilities_current', 'accountType': 'balance_sheet', 'normalBalance': 'credit', 'isControlAccount': False},
    {'glCode': '130020', 'description': 'Loans & Advances to Staff',      'accountGroup': 'assets_current',      'accountType': 'balance_sheet', 'normalBalance': 'debit',  'isControlAccount': False},
    {'glCode': '420020', 'description': 'PF Employer Contribution',       'accountGroup': 'expenses_indirect',   'accountType': 'profit_loss',   'normalBalance': 'debit',  'isControlAccount': False},
    {'glCode': '420030', 'description': 'ESI Employer Contribution',      'accountGroup': 'expenses_indirect',   'accountType': 'profit_loss',   'normalBalance': 'debit',  'isControlAccount': False},
    {'glCode': '420040', 'description': 'Staff Welfare & Benefits',       'accountGroup': 'expenses_indirect',   'accountType': 'profit_loss',   'normalBalance': 'debit',  'isControlAccount': False},
    {'glCode': '420050', 'description': 'OT, Bonus & Incentive Expense',  'accountGroup': 'expenses_indirect',   'accountType': 'profit_loss',   'normalBalance': 'debit',  'isControlAccount': False},
]

HR_STATUTORY_GL_UPDATES = {
    'STA/0009': '220110',
    'STA/0010': '220110',
    'STA/0011': '220110',
    'STA/0012': '220120',
    'STA/0013': '220120',
    'STA/0014': '220130',
}

HR_STATUTORY_SEED_ADDITION = {
    'partyCode': 'STA/0015',
    'partyType': 'statutory',
    'name': 'TDS u/s 192 — Salary',
    'isActive': True,
    'authorityType': 'tds',
    'glCode': '220140',
    'returnFrequency': 'monthly',
    'dueDateDay': 7,
}


class BootstrapRequest(BaseModel):
    company_id: str
    user_uid: str


@router.post('/bootstrap')
def bootstrap_hr(req: BootstrapRequest):
    db = firestore.client()
    log = []
    batch = db.batch()

    # 1. Seed HR GL accounts
    gl_col = db.collection('companies').document(req.company_id).collection('acc_glAccounts')
    existing = {d.id for d in gl_col.stream()}
    added = 0
    for gl in HR_GL_SEEDS:
        if gl['glCode'] not in existing:
            ref = gl_col.document(gl['glCode'])
            batch.set(ref, {**gl, 'isActive': True, 'openingBalance': 0, 'createdAt': SERVER_TIMESTAMP})
            added += 1
    log.append(f'GL accounts: added {added}, skipped {len(HR_GL_SEEDS) - added}')

    # 2. Update statutory GL codes
    parties_col = db.collection('companies').document(req.company_id).collection('acc_parties')
    sta_docs = parties_col.where('partyType', '==', 'statutory').stream()
    updated = 0
    for sta in sta_docs:
        code = sta.to_dict().get('partyCode', '')
        new_gl = HR_STATUTORY_GL_UPDATES.get(code)
        if new_gl and not sta.to_dict().get('glCode'):
            batch.update(sta.reference, {'glCode': new_gl, 'updatedAt': SERVER_TIMESTAMP})
            updated += 1
    log.append(f'Statutory GL codes: updated {updated}')

    # 3. Add STA/0015 if missing
    sta15 = list(parties_col.where('partyCode', '==', 'STA/0015').limit(1).stream())
    if not sta15:
        ref = parties_col.document()
        batch.set(ref, {
            **HR_STATUTORY_SEED_ADDITION,
            'companyId': req.company_id,
            'createdAt': SERVER_TIMESTAMP,
            'createdBy': req.user_uid,
        })
        log.append('STA/0015 added')
    else:
        log.append('STA/0015 already present')

    batch.commit()
    return {'success': True, 'log': log}


# ── Payroll Runs (stub — Phase 5) ─────────────────────────────────────────────

@router.get('/payroll-runs/{company_id}')
def list_payroll_runs(
    company_id: str,
    branch_id: Optional[str] = Query(None),
    limit: int = Query(12, ge=1, le=60),
):
    db = firestore.client()
    col = db.collection('companies').document(company_id).collection('hr_payroll_runs')
    q = col.order_by('periodStart', direction=firestore.Query.DESCENDING).limit(limit)
    if branch_id:
        q = col.where('branchId', '==', branch_id).order_by('periodStart', direction=firestore.Query.DESCENDING).limit(limit)
    return [{'id': d.id, **d.to_dict()} for d in q.stream()]


# ── Attendance (stub — Phase 3) ───────────────────────────────────────────────

@router.get('/attendance/{company_id}')
def get_attendance(
    company_id: str,
    branch_id: Optional[str] = Query(None),
    month: Optional[str] = Query(None, description='YYYY-MM'),
):
    # Phase 3 implementation
    raise HTTPException(status_code=501, detail='Attendance API — Phase 3, coming soon')
