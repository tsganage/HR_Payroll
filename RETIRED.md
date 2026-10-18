# HR_Payroll is retired

HR & Payroll now lives inside the Novota ERP (`Invoice-Digitizer`, the HR module, the employee app and the
employee portal). This standalone app has no running backend (its FastAPI service is not deployed anywhere) and no
authentication on that backend, so it must not be put back into service as it stands.

- **Do not deploy Firestore rules from this folder.** It shares a database with the ERP. `firebase.json` no longer
  contains a `firestore` section and `firestore.rules` denies everything, so a deploy cannot replace the ERP's rules.
- The hosting site `hr-payroll-invoice-app.web.app` still serves the old front end (last released 7 Mar 2026). It can
  no longer read company data: the ERP's rules need claims this app never obtains. Take the site down in the Firebase
  console (Hosting, site `hr-payroll-invoice-app`, Disable) when you are ready.
- Seed scripts (`seed_*.py`) are kept for reference only.

DPDP plan step 14.
