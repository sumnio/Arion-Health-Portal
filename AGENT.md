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
- Use mock data until instructed to connect the selected backend.
- Keep components reusable.
- Avoid duplicated code.
- Keep backend logic outside UI components.
- Do not expose secrets in frontend code.
- Keep role-based access in mind.
- Implement only the requested milestone.
- Keep frontend mock repositories active until a milestone explicitly migrates a feature to the backend API.
- Patient self-service APIs must derive Patient ownership from the authenticated UserProfile; never trust a client-supplied `patient_id`.
- Doctor scheduling APIs must derive Doctor ownership from the authenticated UserProfile; never trust a client-supplied `doctor_id` for own-schedule mutations.
- Keep scheduling time conversion centralized. The current development timezone is `Asia/Manila`; clinic opening and closing times remain optional until approved values are configured.
- Clinical APIs must derive Patient and Doctor ownership from authenticated profiles and linked Appointments. Saved MedicalRecords, Prescriptions, and issued MedicalCertificates are read-only; consultation completion belongs only to the assigned Doctor after check-in and MedicalRecord creation.

## Authentication rules

- `/login` is the one shared login route for Patient, Doctor, Staff, and Admin.
- `/register` is Patient self-registration only. Doctor and Staff accounts are Admin-provisioned; Admin accounts are provisioned separately.
- Real authentication must not ask the user to select a role. Role comes from the trusted UserProfile linked to the authenticated user.
- Protected routes require an authenticated user, an active account, and the permitted role. Frontend redirects are navigation behavior, not the security boundary; backend authorization and database access controls must enforce access later. Use RLS when the selected provider supports it.
- Backend protected actions must compose authentication, active-account, role/permission, and resource-ownership checks as applicable. Return 401 for missing/invalid authentication and 403 for inactive, wrong-role, or failed-ownership access.
- Admin is not a clinical superuser. Staff cannot create clinical records, issue certificates, or complete consultations. Consultation completion is Doctor-only and must also verify the assigned Doctor.
- Mock role selection and “Exit mock preview” controls are temporary development behavior and must be removed when the frontend is intentionally migrated to backend authentication.

## Backend portability

- The selected backend direction is Express + Node.js + MongoDB.
- Keep database and backend access behind service modules or API abstractions.
- Do not call a database, Supabase, or another provider directly throughout UI components.
- Keep the frontend service boundary independent from Express implementation details so feature services can migrate incrementally.
- Keep frontend components independent from backend provider-specific logic.
