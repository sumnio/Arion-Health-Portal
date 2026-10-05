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
- Preserve targeted abuse protection: login allows 10 failed attempts per 15 minutes, registration allows 5 requests per 60 minutes, and authenticated Admin Doctor/Staff provisioning shares 20 requests per 15 minutes. Return safe `429 RATE_LIMITED` responses, keep normal reads unthrottled, and never treat rate limiting as a substitute for authorization. Production uses the shared MongoDB rate-limit store and fails closed if that store is unavailable; local development and tests remain deterministic. Production Vercel requests trust exactly one proxy hop; development and tests retain Express's default proxy behavior. Preview verified resolved request IPs and the shared login budget; repeat the checks on the final Production ingress.
- Treat every request body, query value, and route parameter as untrusted. Mutations must use explicit field allowlists, reject server-owned identity/status fields, validate ObjectIds before repository access, bound strings and nested collections, and reject object/operator-style query input. Bodyless state-transition actions must reject non-empty bodies. List endpoints must bound pagination and search input.
- Never pass a raw request body or query object into Mongoose. Services and repositories may receive only validated, normalized values. Keep safe structured client errors and do not expose stack traces, database details, credentials, password hashes, or signature storage paths.
- Keep `MONGODB_URI`, `AUTH_SECRET`, `MFA_ENCRYPTION_KEY`, Admin bootstrap credentials, and other backend credentials only in ignored `server/.env` or the deployment secret store. Frontend `VITE_` configuration may contain only public values such as `VITE_API_BASE_URL`.
- Non-test startup requires `MONGODB_URI`, a unique non-placeholder `AUTH_SECRET` of at least 32 characters, a base64-encoded 32-byte `MFA_ENCRYPTION_KEY`, a supported `NODE_ENV`, and explicit production CORS origins. Never log secret values or silently generate authentication or encryption secrets.
- Credentialed CORS uses only the explicit comma-separated `CORS_ORIGIN` allowlist. Browser origins outside it are denied; requests without an Origin header remain allowed for health checks, API tools, and server-to-server clients. Never combine credentials with wildcard CORS.
- Keep the `arion_auth` cookie HttpOnly, SameSite=Lax, host-only, scoped to `/`, valid for eight hours, Secure in production, and non-Secure only for local/test HTTP. Logout must clear it with the same path, SameSite, and Secure attributes. Production requires HTTPS. Cookie domain and `trust proxy` remain deployment decisions and must not be guessed.
- Admin login requires TOTP MFA. Password verification may create only the separate ten-minute `arion_mfa_challenge` HttpOnly cookie; it must never grant protected access. Issue `arion_auth` only after successful MFA verification, encrypt TOTP secrets with the separately configured `MFA_ENCRYPTION_KEY`, consume challenges after success, and never log MFA secrets, codes, QR URIs, or challenge values.
- Emit structured server-side security events only for authentication outcomes, rate-limit triggers, meaningful authorization/ownership denials, Admin provisioning and account lifecycle actions, and security-relevant input rejection. Never log credentials, tokens, cookies, connection strings, request bodies, protected signature paths, or clinical content. Security logging failures must never fail a user request.
- Request IP logging uses Express's resolved `request.ip`. Production Vercel requests use one trusted proxy hop so the sanitized forwarded client IP can reach rate limiting and security logs. Preview verified this against Vercel ingress; repeat it for final Production. Persistent log storage, retention, alerting, SIEM, and hosting-log integration remain deployment/operations decisions.
- Keep frontend and backend dependency audits separate and retain both lockfiles. Review direct/transitive and runtime/dev-only impact before changing packages. Never run `npm audit fix --force` or take major upgrades automatically; when audits are clean, avoid version and lockfile churn solely for freshness.
- Milestone 23 is the completed security baseline. Preserve the focused cross-role regression matrix in `server/test/securityRegression.test.js`, keep disposable live validators compatible with mandatory Admin MFA, and rerun backend tests, frontend tests, both dependency audits, and the production build after security-sensitive changes. HTTPS termination, verified proxy trust, distributed rate-limit storage, durable security-log retention/access, alerts/SIEM, hosting cookie-domain needs, firewall/WAF controls, backups, and monitoring remain deployment responsibilities.
- Browser E2E tests live under `e2e/` and use Playwright Chromium against the real React -> Express -> MongoDB stack. Keep E2E data in a dedicated database whose name contains `e2e`, create accounts through approved API/service paths, prefix disposable identities with `e2e-`, and clean only exact generated records. Never reuse a running server unless it is explicitly configured for the same E2E database.
- Preserve real cookie authentication and Admin MFA in E2E tests. Use accessible selectors, zero local retries, failure-only artifacts, and the shared helpers/fixtures. Do not add browser mocks, localStorage tokens, global MFA bypasses, broad collection cleanup, or secrets in `VITE_` variables.
- Patient browser journeys live under `e2e/patient/` and use `PatientScenario` for complete disposable account, Doctor scheduling, appointment, record, Prescription, and certificate data. Generate dates from the configured clinic timezone, keep tests order-independent, assert expected backend denials as well as hidden UI actions, and clean every scenario through its exact linked E2E identities.
- Doctor browser journeys live under `e2e/doctor/` and reuse the exact-cleanup scenario boundary for disposable Doctor credentials, assigned Patients, scheduling resources, appointments, records, Prescriptions, and certificates. Exercise scheduling and clinical actions through the real UI or authenticated API boundary, retain assignment/ownership denial checks, and never weaken Doctor-only completion or immutable clinical-resource rules for test convenience.
- Staff browser journeys live under `e2e/staff/` and use `StaffScenario` for complete Staff credentials plus reusable Patient, Doctor, walk-in, appointment, queue, record, Prescription, and certificate state. Preserve same-day walk-in rules, server-derived queue ordering, the shared Senior/PWD tier, Doctor-only completion, and Staff's limited clinical projection. Cleanup must remain scoped to exact scenario identities and relationships.
- Admin browser journeys live under `e2e/admin/` and use `AdminScenario` for disposable bcrypt-backed Admin accounts, real encrypted TOTP enrollment/verification, and exact account-lifecycle cleanup. Never bypass MFA, expose setup secrets to logs or retained artifacts, store tokens in browser storage, broaden Admin clinical permissions, or delete permanent Admin accounts.
- Cross-role browser security journeys live under `e2e/security/`. Preserve unauthenticated and inactive-session denial, frontend role guards, Patient/Doctor ownership isolation, Staff data minimization, pre-MFA Admin denial, Admin account-only scope, protected-field/input abuse rejection, safe 4xx responses, and no browser token storage. Keep the intentionally exhausting MFA rate-limit test last under `e2e/zz-security/` so it cannot affect other Admin tests.
- Milestone 24 is complete through 24.7. Preserve the 48-test E2E suite, zero-retry local behavior, exact per-scenario cleanup, MFA artifact protections, and production source/bundle separation from mocks and E2E code. Milestone 25 is complete through 25.8; use `PROJECT_HANDOFF.md` and `OPERATIONS_RUNBOOK.md` as the current deployment and operational handoff.
- Milestone 25.2 prepares one Vercel Services project with the Vite frontend at `/` and the Express backend at `/api/*`. Keep API routing ahead of the frontend SPA fallback, keep `server/src/server.js` for local listening, and use `server/src/vercel.js` as the listener-free deployment handler. Production frontend API calls are same-origin with an intentionally empty `VITE_API_BASE_URL` because request paths already include `/api`.
- Reuse the cached Mongoose connection and in-flight connection promise in serverless execution. Do not add per-request `mongoose.connect()` calls or local persistent filesystem assumptions. Use `MONGODB_DB_NAME` to isolate Preview data from development, E2E, and future Production databases.
- Milestone 25.3 retains only the protected Vercel Preview deployment `dpl_HoNwvbX144mjwZtyRC333jE8aPQ8` at `https://arion-health-preview.vercel.app`, backed by the isolated free Atlas Preview resource and Preview-only configuration. A non-operational bootstrap deployment used to unlock Preview creation was deleted, its unexpectedly assigned Production alias was removed immediately, and Production environment configuration remains empty. Never promote or reuse Preview resources for Production.
- Preview configuration uses an exact stable origin, same-origin `/api` requests, new Preview-only cryptographic secrets, and the shared MongoDB limiter. Live health, routing, HTTPS cookies, role sessions, Admin MFA, CORS, proxy-resolved IPs, structured security logs, security headers, MongoDB connectivity, shared limiter behavior, and exact disposable-data cleanup are verified. Preserve Deployment Protection. Doctor signature object storage/rendering, durable security logging, Atlas Production setup/backups, Production secrets/clinic values, monitoring, alerts, and final Production deployment remain blockers.
- Milestone 25.4 has a free-tier restricted Production deployment at `https://arion-health-portal.vercel.app`, backed by the isolated `arion-health-production` Atlas resource and `arion_health_production` database. It is for school/demo use and synthetic testing only; never process real patient or clinical data. Atlas Free has no managed backups/PITR, while Vercel Hobby has one-hour logs and no Log Drain, so disaster recovery, durable logging, and alerts remain deferred.
- Production runtime configuration fails closed without explicit `MONGODB_DB_NAME`, `CLINIC_TIME_ZONE`, `CLINIC_NAME`, and real `CLINIC_LOCATION`; operating hours are intentionally unset. The permanent Admin was bootstrapped once into the configured Production database, temporary `ADMIN_*` values were removed, and TOTP enrollment, subsequent MFA login, session restoration, logout, empty browser token storage, and protected-route denial were verified. Keep Production `CERTIFICATE_ISSUANCE_ENABLED=false` and `VITE_CERTIFICATE_ISSUANCE_ENABLED=false` until protected Doctor signature storage and authorized rendering are implemented.
- Milestone 25.5 repeated live Production security validation: HTTPS/HSTS and security headers, exact-origin CORS with untrusted and Preview-origin denial, same-origin API routing, two Admin MFA logins with pre-MFA denial, reload restoration, logout and repeat-MFA enforcement, the shared ten-failure login budget, sanitized forwarded-IP handling, redacted runtime logs, environment separation, empty Doctor/Staff/Patient counts, and certificate restriction all passed. Preserve the 107 frontend, 242 backend, and 48 E2E regression baseline. Production remains **DEPLOYED + RESTRICTED** with no real clinical data, managed backups/PITR, durable logs, alerts, or enabled certificate issuance.
- Milestone 25.6 operations follow `OPERATIONS_RUNBOOK.md`. Use only free-tier Vercel and Atlas capabilities. Do not claim durable log retention, Log Drain, managed backup/PITR, paid monitoring, or full disaster recovery. Manual Production dumps require explicit operator approval, the guarded environment-driven helper, an encrypted destination, and no automatic schedule; restore only to a disposable local/test database. Vercel rollback never restores Atlas data.
- Preserve the restricted Production boundary: synthetic/demo data only, Preview isolation, disabled certificate issuance, and no Doctor signature-storage work. Keep backup artifacts ignored, never print Production environment values, and keep `AUTH_SECRET`, `MFA_ENCRYPTION_KEY`, Atlas credentials, and permanent Admin credentials in approved external secret custody.
- Milestone 25.7 passed a dedicated live Production smoke for Patient, Doctor, Staff, and the permanent MFA Admin. Disposable records use obvious `prod-smoke-*` markers, must be removed by exact generated IDs in a guaranteed cleanup path, and must never include real clinical content. Live lifecycle, wrong-role, Patient ownership, session/logout, CORS, rate-limit, security-header/log, and certificate fail-closed checks passed; the Admin was preserved active and MFA-enrolled, and the Production role directories returned to zero after cleanup. Keep the 107 frontend, 242 backend, and 48 E2E regression baseline.
- Milestone 25.8 closes the MVP documentation and handoff. Production remains **DEPLOYED + RESTRICTED**, synthetic/demo-only, and unauthorized for real clinical use. Do not enable Production certificate issuance, claim managed recovery or durable logging, or start a post-MVP backlog item without an explicitly approved scope. Keep `PROJECT_HANDOFF.md` synchronized when operational truth changes.

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
