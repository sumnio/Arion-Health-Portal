# Arion Health Portal

Arion Health Portal contains a React frontend and a Node.js, Express, MongoDB, and Mongoose backend. Authentication and all four role portals use the backend API.

## Run locally

Use Node.js 24 LTS and npm.

```sh
npm ci
```

Copy `.env.example` to `.env.local` first and set `VITE_API_BASE_URL` to the backend origin. The example uses `http://127.0.0.1:5000`.

```sh
npm run dev
```

Start the configured backend first, then open the local URL printed by Vite. Login uses real account credentials and the trusted backend role; it no longer asks for a preview role. Patient registration creates a real Patient account and then directs the user to login. Authentication uses an HttpOnly cookie, so the frontend sends credentials and stores no JWT in localStorage or sessionStorage. Startup restores the session through `/api/auth/me`, and protected routes require the correct active role.

Patient profile, booking, appointment, record, and certificate screens, all Doctor screens, all Staff operational screens, and Admin account-management screens use live APIs. Public pages retain their approved design and omit social login, password recovery, and other unapproved features. All live calls use the centralized `src/services/apiClient.js` through feature repository/service adapters.

The normal local development origins are:

- Frontend: `http://127.0.0.1:5173`
- Backend: `http://127.0.0.1:5000`
- Backend `CORS_ORIGIN`: `http://127.0.0.1:5173`

Use matching origins when testing cookie authentication. Configure production origins through environment variables; do not hardcode development origins in feature pages.

The Express API applies Helmet's standard security headers before CORS and routes, keeps `X-Powered-By` disabled, and limits JSON request bodies to `100kb`. Malformed JSON returns a structured `400 INVALID_JSON`; oversized JSON returns `413 PAYLOAD_TOO_LARGE`. Both responses use the centralized error format and leave the server available. The API does not accept URL-encoded form bodies, so no URL-encoded parser is installed. Helmet's default CSP is retained because the server exposes JSON APIs rather than frontend HTML. HSTS is disabled for local/non-production HTTP and enabled through Helmet in production; the final HTTPS proxy and HSTS behavior must be verified during deployment.

Targeted IP-based rate limiting protects `POST /api/auth/login` (10 failed attempts per 15 minutes), `POST /api/auth/register` (5 requests per 60 minutes), and the shared Admin provisioning budget for `POST /api/admin/doctors` and `POST /api/admin/staff` (20 authenticated Admin requests per 15 minutes). Limits may be adjusted with `AUTH_LOGIN_RATE_LIMIT_WINDOW_MS`, `AUTH_LOGIN_RATE_LIMIT_MAX`, `AUTH_REGISTER_RATE_LIMIT_WINDOW_MS`, `AUTH_REGISTER_RATE_LIMIT_MAX`, `ADMIN_PROVISION_RATE_LIMIT_WINDOW_MS`, and `ADMIN_PROVISION_RATE_LIMIT_MAX`. A blocked request returns structured `429 RATE_LIMITED` JSON plus standard rate-limit headers. Successful logins do not consume the login failure budget, and `/api/auth/me`, health, portal reads, and other normal API traffic are not rate-limited by this milestone. This per-process MVP protection does not add account lockout, persistent failure counters, MFA, or a global limiter. Keep Express's default direct-IP behavior locally; production `trust proxy` must be configured only after the actual proxy chain is known and verified.

```sh
npm test
npm run build
npm run preview
```

## Backend foundation

Install and configure the backend independently:

```sh
cd server
npm install
copy .env.example .env
```

Set `MONGODB_URI` in `server/.env` to a development MongoDB connection string. Generate a unique random `AUTH_SECRET` of at least 32 characters for signing authentication JWTs. Placeholder and weak secrets are rejected outside tests, and the server never generates a replacement automatically. Keep that file local; `.env` files are ignored by Git. Do not place credentials or a real secret in `.env.example`.

`CORS_ORIGIN` is a comma-separated allowlist of exact trusted browser origins, for example `http://127.0.0.1:5173,http://localhost:5173`. Entries must be origin-only HTTP(S) URLs. Wildcards, credentials in URLs, paths, malformed values, and empty entries are rejected. Credentialed browser requests receive CORS access only when their Origin is listed. Requests without an Origin header remain available for health checks, API tools, and server-to-server requests.

The root frontend environment may expose only public `VITE_` values. `VITE_API_BASE_URL` is public and expected. Never add MongoDB URIs, authentication secrets, passwords, private keys, Admin bootstrap credentials, or backend tokens to root frontend environment files or a `VITE_` variable.

Set `CLINIC_LOCATION` to the real clinic address before issuing certificates. If it is omitted, certificate views show a clear “Clinic location not configured” value instead of fake clinic information.

Then run:

```sh
npm run dev
```

The API starts only after required configuration passes validation and MongoDB connects. `NODE_ENV` must be `development`, `test`, or `production`; production additionally requires an explicit `CORS_ORIGIN`. Available endpoints include:

- `GET /api/health`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/patient/profile`
- `PATCH /api/patient/profile`
- `GET /api/patient/doctors`
- `POST /api/patient/appointments`
- `GET /api/patient/appointments`
- `GET /api/patient/appointments/:appointmentId`
- `PATCH /api/patient/appointments/:appointmentId/cancel`
- `PATCH /api/staff/appointments/:appointmentId/confirm`
- `GET`, `POST /api/doctor/availability`
- `PATCH`, `DELETE /api/doctor/availability/:id`
- `GET`, `POST /api/doctor/published-availability`
- `DELETE /api/doctor/published-availability/:id`
- `GET`, `POST /api/doctor/blocked-times`
- `DELETE /api/doctor/blocked-times/:id`
- `GET /api/patient/doctors/:doctorId/available-slots?date=YYYY-MM-DD`
- `POST /api/doctor/appointments/:appointmentId/medical-record`
- `PATCH /api/doctor/appointments/:appointmentId/complete`
- `GET /api/doctor/patients/:patientId/records`
- `GET /api/doctor/records/:recordId`
- `POST /api/doctor/records/:recordId/certificates`
- `GET /api/doctor/certificates/:certificateId`
- `GET /api/patient/records`
- `GET /api/patient/records/:recordId`
- `GET /api/patient/certificates`
- `GET /api/patient/certificates/:certificateId`
- `GET /api/staff/patients?search=`
- `GET /api/staff/patients/:patientId`
- `GET /api/staff/doctors`
- `GET /api/staff/appointments?date=YYYY-MM-DD`
- `POST /api/staff/patients/walk-in`
- `POST /api/staff/patients/:patientId/walk-in-appointments`
- `PATCH /api/staff/appointments/:appointmentId/check-in`
- `PATCH /api/staff/appointments/:appointmentId/priority`
- `PATCH /api/staff/appointments/:appointmentId/no-show`
- `PATCH /api/staff/appointments/:appointmentId/cancel`
- `GET /api/staff/queue`
- `GET /api/staff/patients/:patientId/record-summary`
- `GET`, `POST /api/admin/doctors`
- `GET`, `PATCH /api/admin/doctors/:doctorId`
- `PATCH /api/admin/doctors/:doctorId/deactivate`
- `PATCH /api/admin/doctors/:doctorId/reactivate`
- `GET`, `POST /api/admin/staff`
- `GET`, `PATCH /api/admin/staff/:staffId`
- `PATCH /api/admin/staff/:staffId/deactivate`
- `PATCH /api/admin/staff/:staffId/reactivate`
- `GET /api/admin/patients`
- `GET /api/admin/patients/:patientId`
- `PATCH /api/admin/patients/:patientId/deactivate`
- `PATCH /api/admin/patients/:patientId/reactivate`

Authentication uses bcryptjs password hashes and a signed JWT in an HttpOnly cookie. The frontend origin must match `CORS_ORIGIN`, and credentialed CORS is enabled for that configured origin. The `arion_auth` cookie is host-only with `HttpOnly`, `SameSite=Lax`, `Path=/`, and an eight-hour lifetime. It is not readable by frontend JavaScript. Local/test HTTP uses `Secure=false`; production always uses `Secure=true` and therefore requires HTTPS. Logout clears the cookie with matching path, SameSite, and Secure behavior. A cookie Domain is intentionally unset. Final reverse-proxy configuration, HTTPS termination, cookie domain needs, and Express `trust proxy` must be decided from the actual hosting architecture during deployment; `trust proxy` remains disabled for now.

Security-relevant activity is written as structured server-side JSON through `server/src/services/securityLogger.js`. Logged events cover authentication outcomes, logout, inactive-account denial, rate limits, authorization and ownership denials, Admin Doctor/Staff provisioning, account activation/deactivation, and protected-field or operator-style input rejection. Normal reads and ordinary business validation are intentionally excluded.

The logger uses an allowlisted event shape and recursively redacts dangerous metadata keys. Never add passwords, password hashes, JWTs, cookies, authorization headers, secrets, MongoDB URIs, private keys, full request bodies, signature paths, diagnoses, notes, prescriptions, or certificate contents to security events. Failed-login logs use a generic reason and do not record the submitted email. Logging failures are swallowed so telemetry cannot break API requests.

The logged IP is Express's current direct request IP. `trust proxy` remains disabled until the real proxy topology is verified, so production client-IP accuracy must be finalized during deployment. Durable retention, restricted log access, alerting, hosting-log transport, and SIEM integration are also deployment/operations work; the MVP does not create a MongoDB security-log collection.

### Dependency security

The frontend and backend dependency trees were audited independently on 2026-09-26. Both `npm audit` runs reported zero known vulnerabilities at critical, high, moderate, and low severity. All direct packages have confirmed runtime, build, test, or development usage; both top-level installation trees are valid; no direct package is marked deprecated; and no unused or redundant package was found.

No package or lockfile was changed because the audits were clean. Vite has a routine compatible patch available, while dotenv and Mongoose have newer major releases; none addresses a current audit finding, so these remain candidates for a separate maintenance change with compatibility testing. Keep both lockfiles committed, audit the two workspaces separately, and never use `npm audit fix --force` or accept breaking major upgrades without review.

Run the audits from their respective directories:

```sh
# Frontend
npm audit

# Backend
cd server
npm audit
```

Backend tests use an ephemeral HTTP port and isolated repositories, so they do not require a live database:

```sh
npm test
```

Backend authorization uses reusable authentication, active-account, role, permission, and ownership middleware. Unauthenticated requests return 401; authenticated requests denied by account status, role, permission, or ownership return 403. Admin permissions are limited to account management, Staff permissions remain operational, and Doctor clinical actions still require feature-specific assignment checks. Internal authorization probe routes are disabled during normal API operation.

Backend request validation uses explicit allowlists for mutation bodies and list queries. Server-owned identifiers, roles, account/appointment/certificate statuses, certificate numbers, creator links, password hashes, and ownership links cannot be supplied through unrelated actions. ObjectIds are validated before repository access; search text is limited to 100 characters; list limits are capped at 50; passwords are capped at 128 characters; prescriptions and allergies are capped at 20 entries; and narrative fields use endpoint-appropriate length bounds. Object/operator-style query values and unknown query keys are rejected. State-transition endpoints such as cancel, confirm, check-in, no-show, consultation completion, account lifecycle, logout, and availability deletion accept no request fields.

Validation and authorization are separate controls. Every protected route still requires authentication, active-account enforcement, its approved role or permission, and ownership/assignment checks where applicable. Repositories receive normalized fields instead of raw HTTP bodies or queries. Client errors use structured, non-sensitive responses; unexpected failures do not disclose stack traces, database details, credentials, hashes, or protected signature paths.

Milestone 23.3 completed a route-by-route authorization and input audit across Patient, Doctor, Staff, and Admin APIs. The audit retained the approved role boundaries and immutable clinical-resource rules while adding focused regression coverage for cross-user access, all inactive roles, protected fields, malformed identifiers, unsafe queries, and state-transition abuse.

Patient routes resolve ownership from the authenticated UserProfile and never accept a Patient ID for self-service operations. Appointment creation produces `pending` appointments, uses canonical visit types, and requires an explicitly published, unblocked, unoccupied 30-minute slot within 14 days. Patients may cancel only their own future pending or confirmed appointments before check-in and before a MedicalRecord exists; cancellation preserves the record. Checked-in, recorded, completed, cancelled, and no-show appointments reject Patient cancellation. The Staff confirmation endpoint only permits pending-to-confirmed.

Doctor scheduling routes resolve the Doctor from the authenticated UserProfile. Publication is limited to 30 days, must fit an active recurring range, and uses 30-minute boundaries. `CLINIC_TIME_ZONE` defaults to `Asia/Manila`. Optional `CLINIC_OPEN_TIME` and `CLINIC_CLOSE_TIME` remain blank until clinic hours are approved; configure both together to enable server enforcement.

Clinical routes enforce authenticated ownership. Doctors create one immutable MedicalRecord per eligible assigned Appointment, optionally with linked Prescriptions, and may issue immutable certificates with server-generated numbers. Patients can read only their own records and issued certificates. Certificate responses resolve Doctor credentials and shared clinic information without returning the protected signature path. Only the assigned Doctor can complete a confirmed, checked-in consultation after its MedicalRecord exists. Staff and Admin are not clinical superusers.

Issued certificates can be downloaded as PDFs from the authenticated Doctor issuance success state and Patient certificate-detail screen. PDF generation uses the already authorized response in the browser, adds no public certificate route, and does not include the protected signature storage path.

Staff operational routes support basic Patient search, guest walk-in registration without an account, same-day confirmed walk-in Appointments, check-in, canonical priority changes, no-show transitions, and the active waiting queue. Queue order is Urgent, Senior/PWD, then Normal, with check-in time ordering inside each tier. Staff has a separate restricted record-summary projection and no consultation-completion or clinical-editing endpoint.

Admin routes provision Doctor and Staff accounts with server-assigned roles and bcrypt password hashes, expose safe non-clinical account projections, and manage explicit active/inactive lifecycle transitions. Deactivation preserves every linked identity and historical relationship while existing authorization blocks protected access. Patient administration covers linked portal status only; walk-ins without accounts cannot be activated/deactivated. No Admin hard-delete or clinical-editing route exists.

Disposable live validation commands use generated credentials and remove only their own records:

```sh
npm run validate:auth
npm run validate:authorization
npm run validate:patient-api
npm run validate:scheduling
npm run validate:clinical
npm run validate:staff-api
npm run validate:admin-api
```

## Structure

- `src/app`: approved route definitions and router.
- `src/components`: reusable branding, navigation, and placeholder content.
- `src/layouts`: public layout and shared shell with four role-specific entry points.
- `src/pages`: live role-specific feature pages.
- `src/services`: provider-independent boundary used by the UI.
- `src/mocks`: legacy deterministic fixtures retained only for existing unit coverage; they are excluded from the production module graph.
- `src/styles`: Tailwind entry and responsive layout styling.
- `scripts`: route coverage and navigation checks against the approved sitemap.
- `server/src/config`: environment and MongoDB connection setup.
- `server/src/models`, `server/src/repositories`: Mongoose domain models and persistence adapters.
- `server/src/controllers`, `server/src/routes`: health, authentication, Patient, Doctor scheduling/clinical, Staff operations, and Admin account endpoints.
- `server/src/services`, `server/src/validation`: password/token logic, authorization policy, Patient/appointment business rules, shared input limits, field allowlists, query validation, and request normalization.
- `server/src/middleware`: authentication, active-account, role, permission, ownership, validation, JSON 404, and centralized error handling.
- `server/test`: backend foundation, model, authentication, authorization, feature API, and HTTP security tests.

Feature integrations remain behind frontend services. Frontend authentication and all Patient, Doctor, Staff, and Admin portal features are connected to the backend through the centralized credentialed API client. Admin integration uses the existing account-management APIs for dashboard totals, paginated search, provisioning, approved profile updates, and active/inactive lifecycle changes. Staff integration adds safe Staff-only appointment/calendar, active Doctor directory, basic Patient detail, and cancellation endpoints; detailed clinical data remains unavailable, while the dedicated record-summary endpoint returns only encounter, Doctor, and diagnosis summary. The Doctor integration adds `GET /api/doctor/appointments` for an ownership-scoped schedule/current-consultation projection; it accepts optional date and Patient filters and never accepts a client-selected Doctor identity.

Milestone 22 is complete. Runtime role modules have no dependency on the retained mock fixtures, API errors use shared safe status handling, and date/time normalization is centralized. Regression coverage protects route guards, real API repository usage, cancellation restrictions, authenticated certificate PDF availability, and protected signature-path exclusion.

Source documents currently live at the repository root (`AGENT.md`, `PROJECT_SPEC.md`, `SCHEMA.md`, `ERD.md`, `SITEMAP.md`), with images in `wireframe/`. See `MILESTONE_1_NOTES.md` for discrepancies. Original approval documents are unchanged.

Production hosting will need an SPA fallback to `index.html` for direct route loads. Deployment is outside this milestone.
