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
- Treat every request body, query value, and route parameter as untrusted. Mutations must use explicit field allowlists, reject server-owned identity/status fields, validate ObjectIds before repository access, bound strings and nested collections, and reject object/operator-style query input. Bodyless state-transition actions must reject non-empty bodies. List endpoints must bound pagination and search input.
- Never pass a raw request body or query object into Mongoose. Services and repositories may receive only validated, normalized values. Keep safe structured client errors and do not expose stack traces, database details, credentials, password hashes, or signature storage paths.
- Keep `MONGODB_URI`, `AUTH_SECRET`, `MFA_ENCRYPTION_KEY`, Admin bootstrap credentials, and other backend credentials only in ignored `server/.env` or the deployment secret store. Frontend `VITE_` configuration may contain only public values such as `VITE_API_BASE_URL`.
- Non-test startup requires `MONGODB_URI`, a unique non-placeholder `AUTH_SECRET` of at least 32 characters, a base64-encoded 32-byte `MFA_ENCRYPTION_KEY`, a supported `NODE_ENV`, and explicit production CORS origins. Never log secret values or silently generate authentication or encryption secrets.
- Credentialed CORS uses only the explicit comma-separated `CORS_ORIGIN` allowlist. Browser origins outside it are denied; requests without an Origin header remain allowed for health checks, API tools, and server-to-server clients. Never combine credentials with wildcard CORS.
- Keep the `arion_auth` cookie HttpOnly, SameSite=Lax, host-only, scoped to `/`, valid for eight hours, Secure in production, and non-Secure only for local/test HTTP. Logout must clear it with the same path, SameSite, and Secure attributes. Production requires HTTPS. Cookie domain and `trust proxy` remain deployment decisions and must not be guessed.
- Admin login requires TOTP MFA. Password verification may create only the separate ten-minute `arion_mfa_challenge` HttpOnly cookie; it must never grant protected access. Issue `arion_auth` only after successful MFA verification, encrypt TOTP secrets with the separately configured `MFA_ENCRYPTION_KEY`, consume challenges after success, and never log MFA secrets, codes, QR URIs, or challenge values.
- Emit structured server-side security events only for authentication outcomes, rate-limit triggers, meaningful authorization/ownership denials, Admin provisioning and account lifecycle actions, and security-relevant input rejection. Never log credentials, tokens, cookies, connection strings, request bodies, protected signature paths, or clinical content. Security logging failures must never fail a user request.
- Request IP logging uses Express's current direct connection value. Do not enable `trust proxy` until the deployment proxy chain is known. Persistent log storage, retention, alerting, SIEM, and hosting-log integration remain deployment/operations decisions.
- Keep frontend and backend dependency audits separate and retain both lockfiles. Review direct/transitive and runtime/dev-only impact before changing packages. Never run `npm audit fix --force` or take major upgrades automatically; when audits are clean, avoid version and lockfile churn solely for freshness.

## Authentication rules

- `/login` is the one shared login route for Patient, Doctor, Staff, and Admin.
- `/register` is Patient self-registration only. Doctor and Staff accounts are Admin-provisioned; Admin accounts are provisioned separately.
- Real authentication must not ask the user to select a role. Role comes from the trusted UserProfile linked to the authenticated user.
- Protected routes require an authenticated user, an active account, and the permitted role. Frontend redirects are navigation behavior, not the security boundary; backend authorization and scoped repository operations enforce access. Use additional database policy controls when the selected provider supports them.
- Backend protected actions must compose authentication, active-account, role/permission, and resource-ownership checks as applicable. Return 401 for missing/invalid authentication and 403 for inactive, wrong-role, or failed-ownership access.
- Admin is not a clinical superuser. Staff cannot create clinical records, issue certificates, or complete consultations. Consultation completion is Doctor-only and must also verify the assigned Doctor.
- Frontend authentication plus Patient, Doctor, Staff, and Admin portal data use the Express API through centralized credentialed clients. Do not restore mock role selection, preview login, or browser token storage.

## Backend portability

- The selected backend direction is Express + Node.js + MongoDB.
- Keep database and backend access behind service modules or API abstractions.
- Do not call a database, Supabase, or another provider directly throughout UI components.
- Keep the frontend service boundary independent from Express implementation details so feature services can migrate incrementally.
- Keep frontend components independent from backend provider-specific logic.
