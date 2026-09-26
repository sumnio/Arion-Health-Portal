# Arion Health Portal

## Source of truth

Always read:
- PROJECT_SPEC.md
- SCHEMA.md
- ERD.md
- SITEMAP.md
- wireframe/

## Stack

- React
- Tailwind CSS
- React Router
- Backend: Express + Node.js + MongoDB (foundation established under `server/`)
- Vercel

## Roles

- Patient
- Doctor
- Staff
- Admin

## Rules

- Do not invent features.
- Do not change approved routes without permission.
- Do not change the approved schema without permission.
- Use the live Express API for authentication and all Patient, Doctor, Staff, and Admin portal data.
- Keep components reusable.
- Avoid duplicated code.
- Keep backend logic outside UI components.
- Do not expose secrets in frontend code.
- Keep role-based access in mind.
- Implement only the requested milestone.
- Legacy frontend mock repositories and services are deterministic test fixtures only. Production pages, components, layouts, and authentication must not import them or fall back to their data.
- Patient self-service APIs must derive Patient ownership from the authenticated UserProfile; never trust a client-supplied `patient_id`.
- Doctor scheduling APIs must derive Doctor ownership from the authenticated UserProfile; never trust a client-supplied `doctor_id` for own-schedule mutations.
- Keep scheduling time conversion centralized. The current development timezone is `Asia/Manila`; clinic opening and closing times remain optional until approved values are configured.
- Clinical APIs must derive Patient and Doctor ownership from authenticated profiles and linked Appointments. Saved MedicalRecords, Prescriptions, and issued MedicalCertificates are read-only; consultation completion belongs only to the assigned Doctor after check-in and MedicalRecord creation.
- Patient cancellation is allowed only for a future pending or confirmed Appointment before check-in and before a MedicalRecord exists. Checked-in, recorded, completed, cancelled, and no-show Appointments must reject Patient cancellation in both UI and API enforcement.
- Issued certificate PDFs are available in authenticated Doctor and Patient flows. PDF content must use authorized certificate responses and must never expose `Doctor.signature_path` or introduce a public certificate route.
- Staff operational APIs may search/register Patients, create same-day walk-in Appointments, confirm, check in, set canonical priority, mark eligible no-shows, and read the waiting queue. Staff must not complete consultations or receive detailed clinical content.
- Admin account APIs provision Doctor and Staff credentials with server-forced roles and manage active/inactive lifecycle for Doctor, Staff, and linked Patient portal accounts. They never hard-delete identities or expose clinical content.
- Keep the Express HTTP security baseline intact: disable `X-Powered-By`; apply Helmet before CORS, parsers, and routes; limit JSON bodies to `100kb`; and return safe structured 400/413 parser errors. Do not add URL-encoded parsing unless an approved endpoint needs it. Local HTTP must remain usable, while production HSTS and HTTPS termination must be verified at deployment.
- Preserve targeted abuse protection: login allows 10 failed attempts per 15 minutes, registration allows 5 requests per 60 minutes, and authenticated Admin Doctor/Staff provisioning shares 20 requests per 15 minutes. Return safe `429 RATE_LIMITED` responses, keep normal reads unthrottled, and never treat rate limiting as a substitute for authorization. Do not enable `trust proxy` until the deployment proxy chain is verified.

## Authentication rules

- `/login` is the one shared login route for Patient, Doctor, Staff, and Admin.
- `/register` is Patient self-registration only. Doctor and Staff accounts are Admin-provisioned; Admin accounts are provisioned separately.
- Real authentication must not ask the user to select a role. Role comes from the trusted UserProfile linked to the authenticated user.
- Protected routes require an authenticated user, an active account, and the permitted role. Frontend redirects are navigation behavior, not the security boundary; backend authorization and database access controls must enforce access later. Use RLS when the selected provider supports it.
- Backend protected actions must compose authentication, active-account, role/permission, and resource-ownership checks as applicable. Return 401 for missing/invalid authentication and 403 for inactive, wrong-role, or failed-ownership access.
- Admin is not a clinical superuser. Staff cannot create clinical records, issue certificates, or complete consultations. Consultation completion is Doctor-only and must also verify the assigned Doctor.
- Frontend authentication plus Patient, Doctor, Staff, and Admin portal data use the Express API through centralized credentialed clients. Do not restore mock role selection, preview login, or browser token storage.

## Backend portability

- The selected backend direction is Express + Node.js + MongoDB.
- Keep database and backend access behind service modules or API abstractions.
- Do not call a database, Supabase, or another provider directly throughout UI components.
- Keep the frontend service boundary independent from Express implementation details so feature services can migrate incrementally.
- Keep frontend components independent from backend provider-specific logic.
