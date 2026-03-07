import os
import firebase_admin
from firebase_admin import credentials
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from hr.router import router as hr_router

load_dotenv()

# ── Firebase Admin SDK ────────────────────────────────────────────────────────
sa_path = os.getenv('FIREBASE_SERVICE_ACCOUNT_PATH', './firebase-service-account.json')
if not firebase_admin._apps:
    cred = credentials.Certificate(sa_path)
    firebase_admin.initialize_app(cred)

# ── FastAPI app ───────────────────────────────────────────────────────────────
app = FastAPI(title='HR Payroll API', version='1.0.0')

origins = [o.strip() for o in os.getenv('CORS_ORIGINS', 'http://localhost:5174').split(',')]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

app.include_router(hr_router)


@app.get('/health')
def health():
    return {'status': 'ok', 'service': 'hr-payroll'}
