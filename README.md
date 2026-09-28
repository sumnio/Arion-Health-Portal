# Arion Health Portal

Arion Health Portal contains a React frontend and a Node.js, Express, MongoDB, and Mongoose backend. Authentication and all four role portals use the backend API.

## Run locally

Use Node.js 24 LTS and npm.

```sh
npm ci
```

The committed `.env.development` points Vite to `http://127.0.0.1:5000`. Use an ignored `.env.development.local` only when you need a different local API origin. The committed `.env.production` intentionally leaves `VITE_API_BASE_URL` empty so production builds call the same-origin `/api/*` routes.

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

Targeted IP-based rate limiting protects `POST /api/auth/login` (10 failed attempts per 15 minutes), `POST /api/auth/register` (5 requests per 60 minutes), Admin MFA verification (5 failed attempts per 10 minutes), and the shared Admin provisioning budget for `POST /api/admin/doctors` and `POST /api/admin/staff` (20 authenticated Admin requests per 15 minutes). Limits may be adjusted with `AUTH_LOGIN_RATE_LIMIT_*`, `AUTH_REGISTER_RATE_LIMIT_*`, `MFA_VERIFY_RATE_LIMIT_*`, and `ADMIN_PROVISION_RATE_LIMIT_*`. A blocked request returns structured `429 RATE_LIMITED` JSON plus standard rate-limit headers. Successful login and MFA verification do not consume their failure budgets, and `/api/auth/me`, health, portal reads, and other normal API traffic are not rate-limited. Production uses atomic counters in the configured MongoDB database so separate Vercel Function instances share each limiter budget; limiter namespaces remain independent and a store failure returns safe `503 RATE_LIMIT_STORE_UNAVAILABLE` rather than silently disabling protection. Local development and tests remain deterministic. Express keeps direct-IP behavior locally and trusts exactly one proxy hop in production. Preview verified resolved request IPs and the shared counter; the final Production path must be revalidated before public launch.

```sh
npm test
npm run build
npm run preview
```

## Browser end-to-end smoke tests

Milestone 24.1 adds Playwright with one Chromium project under `e2e/`. The smoke suite starts the real React frontend and Express API, checks `/api/health`, loads the public login page, and verifies a disposable Patient can log in through the UI, retain the HttpOnly-cookie session after refresh, and log out. It does not use frontend mocks or browser token storage.

Install Chromium once after installing root dependencies:

```sh
npx playwright install chromium
```

The default E2E origins are `http://127.0.0.1:5173` and `http://127.0.0.1:5000`. Playwright starts both servers automatically with deterministic ports. Existing servers are not reused by default, which prevents an E2E run from silently targeting a developer database. Stop processes already using those ports, override `E2E_BASE_URL` and `E2E_API_URL`, or set `E2E_REUSE_EXISTING_SERVERS=true` only when both existing servers are already configured for the same E2E database.

Copy `server/.env.e2e.example` to the ignored `server/.env.e2e` when a separate connection is needed. Set `E2E_MONGODB_URI` to a dedicated database whose name contains `e2e`, such as `arion_health_e2e`. If it is omitted, the E2E launcher derives `arion_health_e2e` from the existing ignored `server/.env` `MONGODB_URI`; it never prints the connection string. E2E-only auth and MFA values may be supplied as `E2E_AUTH_SECRET` and `E2E_MFA_ENCRYPTION_KEY`. Test secrets stay server-side and must not use a `VITE_` variable.

Run the smoke suite with:

```sh
npm run test:e2e
npm run test:e2e:headed
```

`npm run test:e2e:ui` is available for local debugging. Local retries are disabled; CI may retry once. Screenshots and traces are retained only for failures in ignored `test-results/` and `playwright-report/` directories.

Patient setup uses the real registration API, so bcrypt hashing, UserProfile/Patient linking, validation, rate limiting, security logging, and cookie behavior stay active. Fixture teardown finds the exact `e2e-patient-…@example.invalid` AuthAccount and removes only its linked Patient and UserProfile. It refuses unmarked accounts. Future role journeys should use the helpers in `e2e/helpers`; Admin tests must keep MFA enabled and provide a server-side TOTP code callback to `loginAsAdmin` rather than exposing an MFA secret to the frontend.

Milestone 24.2 adds the Patient journey suite under `e2e/patient/`. It covers login and cookie restoration, profile persistence, published-slot booking and conflict recovery, appointment detail and cancellation, checked-in/recorded/completed cancellation denial, records and Prescriptions, issued certificates and PDF download, empty states, cross-Patient record denial, and logout with protected-route redirect. These tests use the real UI and API; no Patient mock repository is installed in the browser.

Each Patient test owns a `PatientScenario` fixture. Additional accounts are created through the backend authentication repository with the production bcrypt service so repeated setup does not bypass schema/linking rules or exhaust the public registration limiter. Doctors, recurring and published availability, appointments, records, Prescriptions, and certificates are complete Mongoose documents linked to those disposable identities. Dates are generated relative to the current `Asia/Manila` clinic date, and bookable appointments use published 30-minute slots inside the 14-day Patient window.

Scenario teardown follows only the exact generated Patient, Doctor, UserProfile, Appointment, MedicalRecord, Prescription, and MedicalCertificate IDs. It also removes the generated availability ranges and accounts, including appointments created through the browser. The certificate E2E test captures the browser download, verifies its certificate-number filename, and checks the downloaded bytes begin with the PDF signature.

## Backend foundation

Install and configure the backend independently:

```sh
cd server
npm install
copy .env.example .env
```

The committed `server/.env.example` is the production deployment inventory. For local development, set `NODE_ENV=development`, restore `CORS_ORIGIN=http://127.0.0.1:5173,http://localhost:5173`, and set `MONGODB_URI` to a development MongoDB connection string in the ignored `server/.env`. `MONGODB_DB_NAME` is optional locally and selects the database inside that deployment; deployment environments should set it explicitly so Preview, E2E, development, and Production data cannot overlap. Generate a unique random `AUTH_SECRET` of at least 32 characters for signing authentication JWTs. Generate `MFA_ENCRYPTION_KEY` as a separate random 32-byte value encoded with base64; for example, run `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` locally and copy the result into the ignored file. Missing, placeholder, weak, or malformed secrets are rejected outside tests, and the server never generates runtime replacements automatically. Keep that file local; `.env` files are ignored by Git. Do not place credentials or real secrets in `.env.example`.

Admin accounts use authenticator-app TOTP after the normal email/password step. First login shows a QR code and manual setup key; later logins request the six-digit authenticator code. Patient, Doctor, and Staff login remains unchanged. Recovery codes and self-service MFA reset are not implemented; a lost Admin authenticator requires controlled offline operator recovery.

The backend uses `otplib` for TOTP and the frontend uses `qrcode` to render the enrollment URI. Both dependency trees currently pass `npm audit` with zero known vulnerabilities.

`CORS_ORIGIN` is a comma-separated allowlist of exact trusted browser origins, for example `http://127.0.0.1:5173,http://localhost:5173`. Entries must be origin-only HTTP(S) URLs. Wildcards, credentials in URLs, paths, malformed values, and empty entries are rejected. Credentialed browser requests receive CORS access only when their Origin is listed. Requests without an Origin header remain available for health checks, API tools, and server-to-server requests.

The root frontend environment may expose only public `VITE_` values. `VITE_API_BASE_URL` is public. Local development may set it to `http://127.0.0.1:5000`; the same-origin Vercel deployment uses an intentionally empty value because frontend request paths already include `/api`. Never set it to `/api`, which would create `/api/api/...` URLs. Never add MongoDB URIs, authentication secrets, passwords, private keys, Admin bootstrap credentials, or backend tokens to root frontend environment files or a `VITE_` variable.

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

Authentication uses bcryptjs password hashes and a signed JWT in an HttpOnly cookie. The frontend origin must match `CORS_ORIGIN`, and credentialed CORS is enabled for that configured origin. The `arion_auth` cookie is host-only with `HttpOnly`, `SameSite=Lax`, `Path=/`, and an eight-hour lifetime. It is not readable by frontend JavaScript. Local/test HTTP uses `Secure=false`; production always uses `Secure=true` and therefore requires HTTPS. Logout clears the cookie with matching path, SameSite, and Secure behavior. A cookie Domain is intentionally unset. Production on direct Vercel ingress trusts exactly one proxy hop; development and tests retain Express's default. Preview verified HTTPS and sanitized forwarded-IP behavior; repeat the check on the final Production path before launch.

Security-relevant activity is written as structured server-side JSON through `server/src/services/securityLogger.js`. Logged events cover authentication outcomes, logout, inactive-account denial, rate limits, authorization and ownership denials, Admin Doctor/Staff provisioning, account activation/deactivation, and protected-field or operator-style input rejection. Normal reads and ordinary business validation are intentionally excluded.

The logger uses an allowlisted event shape and recursively redacts dangerous metadata keys. Never add passwords, password hashes, JWTs, cookies, authorization headers, secrets, MongoDB URIs, private keys, full request bodies, signature paths, diagnoses, notes, prescriptions, or certificate contents to security events. Failed-login logs use a generic reason and do not record the submitted email. Logging failures are swallowed so telemetry cannot break API requests.

The logged IP is Express's resolved `request.ip`. Local and test execution keep direct-IP behavior; production-mode Vercel execution trusts exactly one proxy hop. Preview runtime logs verified that the sanitized forwarded client IP reaches security events. Durable retention, restricted log access, alerting, hosting-log transport, and SIEM integration remain deployment/operations work; the MVP does not create a MongoDB security-log collection.

### Dependency security

The frontend and backend dependency trees were audited independently on 2026-09-27. Both `npm audit` runs reported zero known vulnerabilities at critical, high, moderate, and low severity. All direct packages have confirmed runtime, build, test, or development usage; both top-level installation trees are valid; no direct package is marked deprecated; and no unused or redundant package was found.

The Milestone 23 audit required no remediation package change. Milestone 24.1 later added `@playwright/test` as a root development dependency and updated the root lockfile for browser E2E infrastructure; the post-install frontend and backend audits remain clean. Vite has a routine compatible patch available, while dotenv and Mongoose have newer major releases; none addresses a current audit finding, so these remain candidates for a separate maintenance change with compatibility testing. Keep both lockfiles committed, audit the two workspaces separately, and never use `npm audit fix --force` or accept breaking major upgrades without review.

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
npm run validate:mfa
```

### Final security regression status

Milestone 23 is complete. The final 2026-09-26 regression pass verifies the HTTP header/body-limit baseline, targeted rate limiting, request validation, role and ownership authorization, inactive-account denial, appointment state rules, immutable clinical resources, authenticated certificate PDF flows, explicit CORS, hardened cookies, safe structured logging, clean dependency audits, and mandatory Admin TOTP MFA. `server/test/securityRegression.test.js` adds a concrete cross-role attack matrix against the real API route groups and verifies that missing, invalid, and pre-MFA Admin sessions cannot access Admin APIs.

The complete backend and frontend suites, production build, live disposable API validators, and browser role walkthrough must remain green. Disposable validation data is identified by exact generated IDs and removed after each live check. Recovery codes remain deferred; losing an Admin authenticator requires controlled offline operator recovery.

Deployment still requires environment-specific controls that cannot be proven by local tests: HTTPS termination, verified reverse-proxy and `trust proxy` configuration, shared/distributed rate-limit storage when horizontally scaled, persistent security-log transport, retention and access policy, optional alerting/SIEM integration, a cookie domain only if the hosting topology needs one, firewall/WAF and hosting protections, database backups, monitoring, and recovery exercises.

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
- `e2e`: Playwright smoke plus Patient, Doctor, Staff, and Admin/MFA journeys with shared browser helpers, complete role-specific scenarios, and exact relationship-scoped cleanup fixtures.

Feature integrations remain behind frontend services. Frontend authentication and all Patient, Doctor, Staff, and Admin portal features are connected to the backend through the centralized credentialed API client. Admin integration uses the existing account-management APIs for dashboard totals, paginated search, provisioning, approved profile updates, and active/inactive lifecycle changes. Staff integration adds safe Staff-only appointment/calendar, active Doctor directory, basic Patient detail, and cancellation endpoints; detailed clinical data remains unavailable, while the dedicated record-summary endpoint returns only encounter, Doctor, and diagnosis summary. The Doctor integration adds `GET /api/doctor/appointments` for an ownership-scoped schedule/current-consultation projection; it accepts optional date and Patient filters and never accepts a client-selected Doctor identity.

Milestone 22 is complete. Runtime role modules have no dependency on the retained mock fixtures, API errors use shared safe status handling, and date/time normalization is centralized. Regression coverage protects route guards, real API repository usage, cancellation restrictions, authenticated certificate PDF availability, and protected signature-path exclusion.

Source documents currently live at the repository root (`AGENT.md`, `PROJECT_SPEC.md`, `SCHEMA.md`, `ERD.md`, `SITEMAP.md`), with images in `wireframe/`. See `MILESTONE_1_NOTES.md` for discrepancies. Original approval documents are unchanged.

Production hosting will need an SPA fallback to `index.html` for direct route loads. Deployment is outside this milestone.

### Doctor end-to-end journeys

Milestone 24.3 adds order-independent Playwright coverage under `e2e/doctor/` for the real Browser -> React -> Express -> MongoDB Doctor workflow. The suite verifies Doctor login and session restoration, assigned dashboard and schedule data, recurring availability lifecycle, published availability constraints, blocked-time lifecycle and appointment-overlap protection, consultation details, immutable MedicalRecord and Prescription creation, duplicate-record rejection, certificate issuance and PDF download, Doctor-owned completion rules, cross-Doctor denial, empty states, logout, and protected-route redirects.

Doctor test accounts use the production bcrypt password service and linked UserProfile/Doctor documents. Dates come from the current `Asia/Manila` clinic date. Every test uses a unique `e2e-` marker and cleanup follows exact Patient, Doctor, profile, appointment, availability, record, Prescription, and certificate relationships; it never clears a collection broadly. Browser monitoring fails tests on uncaught page errors, unexpected console errors, or unexpected HTTP 500 responses.

Run only the Doctor journeys with `npx playwright test e2e/doctor`.

### Staff end-to-end journeys

Milestone 24.4 adds order-independent Playwright coverage under `e2e/staff/` for the real Browser -> React -> Express -> MongoDB Staff workflow. The nine Staff tests cover login and session restoration, live dashboard/calendar data, pending appointment confirmation, Patient search, no-account walk-in registration and duplicate handling, same-day walk-in appointment creation, check-in and duplicate rejection, queue ordering and urgent priority updates, the shared Senior/PWD tier, no-show rules, Doctor-owned completion removal, limited record summaries, clinical-action denial, empty states, logout, and protected-route redirects.

`StaffScenario` creates complete active Staff credentials through the production bcrypt boundary and reuses the Patient/Doctor scenario helpers. Dates use the current `Asia/Manila` clinic date and queue ordering is asserted from server-provided tiers and check-in times. Each test tracks exact Staff, Patient, Doctor, appointment, record, Prescription, certificate, and availability relationships and removes only its own generated data.

Run only the Staff journeys with `npx playwright test e2e/staff`.

### Admin and MFA end-to-end journeys

Milestone 24.5 adds nine order-independent Playwright tests under `e2e/admin/` for the real Browser -> React -> Express -> MongoDB Admin workflow. Coverage includes first-time TOTP enrollment, password-only denial, enrolled Admin login, invalid and expired codes, consumed-challenge replay rejection, MFA rate limiting, session restoration, logout, dashboard data, Doctor and Staff provisioning/profile/lifecycle management, Patient search/pagination/portal lifecycle, no-account walk-ins, protected clinical data, and Admin clinical-action denial.

`AdminScenario` creates disposable Admin accounts with production bcrypt hashing and uses the E2E-only encryption configuration for enrolled TOTP state. Codes are generated in test memory from disposable secrets. The enrollment tests disable screenshots and traces because the real setup screen displays a one-time key; secrets and codes are never logged or placed in browser storage. Expiry is exercised by expiring only the disposable account challenge in the E2E database, while replay reuses the consumed challenge and must receive `MFA_CHALLENGE_INVALID`.

Admin-created Doctor and Staff accounts are discovered by their unique E2E email and added to the exact cleanup scope. Cleanup removes only the scenario's linked AuthAccounts, UserProfiles, role profiles, Patients, appointments, records, Prescriptions, certificates, and availability documents. Run only these journeys with `npx playwright test e2e/admin`.

### Cross-role and security end-to-end journeys

Milestone 24.6 adds misuse-oriented Playwright coverage under `e2e/security/`. It verifies unauthenticated and inactive-session denial, every frontend role guard, Patient and Doctor ownership isolation, Staff's limited diagnosis-summary projection, pre-MFA Admin denial, and Admin's account-only authorization boundary. Direct authenticated browser requests exercise the real Express endpoints when the UI correctly hides a forbidden action.

The suite also covers protected-field and role-escalation attempts, client-supplied creator and certificate-number spoofing, malformed ObjectIds, scalar/object/operator-style query abuse, unexpected bodies on state transitions, browser token-storage absence, safe 4xx responses, and representative response secret filtering. The lightweight MFA abuse test runs last under `e2e/zz-security/` so its intentional in-memory limiter exhaustion cannot affect other journeys.

Run this coverage with `npx playwright test e2e/security`. Credentialed CORS rejection, structured security-log payloads, detailed HTTP cookie attributes, and the complete rate-limiter matrix remain in backend tests where they can be asserted deterministically without fragile external-origin browser behavior.

### Milestone 24 completion and deployment readiness

Milestones 24.1, 24.2, 24.3, 24.4, 24.5, 24.6, and 24.7 are complete. The final readiness pass ran all 48 Playwright tests successfully three consecutive times with retries disabled locally, then passed headed Chromium smoke journeys for Patient booking, Doctor clinical detail, Staff queue and Patient search, and Admin MFA/account management.

Each full run returned every collection in `arion_health_e2e` to zero records. Final cleanup also confirmed no E2E listeners on ports 5000 or 5173, no Playwright or E2E Node processes, and no retained report, screenshot, trace, video, PDF, or MFA enrollment artifact. The MFA enrollment spec keeps trace and screenshot capture disabled.

The Milestone 25.2 verification result is 106/106 frontend tests, 237/237 backend tests, 48/48 browser E2E tests, a successful production build, and zero vulnerabilities in both dependency audits. Production source and bundle scans found no embedded backend secrets, connection strings, private keys, JWT literals, E2E credentials, or Playwright/E2E imports. Retained legacy mocks remain unreachable from the production entry graph.

Required production configuration is documented in the environment setup above: `MONGODB_URI`, `AUTH_SECRET`, `MFA_ENCRYPTION_KEY`, explicit `CORS_ORIGIN`, public `VITE_API_BASE_URL`, `CLINIC_TIME_ZONE`, and `CLINIC_LOCATION`; optional `CLINIC_OPEN_TIME` and `CLINIC_CLOSE_TIME` enable clinic-hour enforcement when approved values are known.

Milestone 25: Deployment is next. Deployment planning must finalize HTTPS termination, reverse-proxy and `trust proxy` configuration, host/domain cookie behavior, shared rate-limit storage if the API is scaled horizontally, durable security logs and retention, monitoring/alerts, firewall/WAF controls, MongoDB backup and recovery, production secret management, the real clinic location, and the final production timezone.

### Milestone 25.2 Vercel preparation

The repository now targets one Vercel Services project:

```text
https://<app-domain>/       -> Vite/React frontend service
https://<app-domain>/api/* -> Express backend service -> MongoDB Atlas
```

`vercel.json` builds the root Vite service with `npm run build` into `dist`, builds `server/` as an Express service through `src/vercel.js`, sends `/api/*` to Express first, and sends all remaining paths to the frontend service. The frontend service rewrites React Router deep links to `index.html`; its SPA fallback never owns API paths. Static frontend responses add nosniff, strict-origin referrer, and frame-denial headers, while Express keeps Helmet for API responses.

The Vercel handler never calls `listen()` or installs signal handlers. It validates backend configuration, awaits a globally cached Mongoose connection/in-flight promise, and reuses one Express app per warm instance. Local development continues to use `server/src/server.js`. Both packages require Node.js `24.x`.

Production variables are assigned by service:

| Service | Variable | Classification |
| --- | --- | --- |
| Frontend | `VITE_API_BASE_URL` (empty) | Public |
| Backend | `MONGODB_URI` | Secret |
| Backend | `AUTH_SECRET` | Secret |
| Backend | `MFA_ENCRYPTION_KEY` | Secret |
| Backend | `NODE_ENV=production` | Non-secret |
| Backend | `CORS_ORIGIN=https://<app-domain>` | Non-secret |
| Backend | `CLINIC_TIME_ZONE`, `CLINIC_LOCATION`, `CLINIC_NAME` | Non-secret/public display configuration |
| Backend | `CLINIC_OPEN_TIME`, `CLINIC_CLOSE_TIME` | Optional non-secret configuration |
| Backend | `*_RATE_LIMIT_WINDOW_MS`, `*_RATE_LIMIT_MAX` | Optional non-secret overrides |

Production and preview values must be configured separately. Preview uses a stable trusted preview alias or one explicitly configured exact preview origin. Wildcard Vercel origins are prohibited. The Admin bootstrap remains a manually invoked controlled script and is not run during build or startup.

Milestone 25.2 itself did not deploy or create cloud resources. Milestone 25.3 subsequently created the isolated Preview resources and completed the live checks documented below. Atlas Production setup/backups, Production secrets, real clinic values, protected signature object storage/rendering, durable logs, monitoring, alerts, and a final Production deployment remain blockers for unrestricted public launch.

### Milestone 25.3 Preview environment status

The repository is linked to the Vercel project `sumnio/arion-health-portal`, and Vercel recognized the configured Vite and Express Services. The deployment tooling version used was Vercel CLI `60.1.3`, invoked explicitly as `npx --yes vercel@60.1.3` so deployment tooling does not add runtime dependency or audit risk to the application. Automatic GitHub connection was not available to the Vercel account for this private repository, so no Git-triggered deployment is configured.

An isolated free MongoDB Atlas resource named `arion-health-preview` is attached only to the Vercel Preview environment. Application data is directed to `arion_health_preview` through `MONGODB_DB_NAME`; it must never be shared with development, E2E, or future Production data. The native integration supplies the Preview connection secret. Preview also has new environment-specific `AUTH_SECRET` and `MFA_ENCRYPTION_KEY` secrets, an exact `CORS_ORIGIN` for the reserved Preview alias, `NODE_ENV=production`, `CLINIC_TIME_ZONE=Asia/Manila`, non-sensitive Preview clinic display values, and an intentionally empty `VITE_API_BASE_URL` for same-origin `/api` requests. Production has no configured environment variables.

The Atlas/Vercel native integration requires Atlas network access from `0.0.0.0/0` because Vercel Functions use dynamic outbound addresses, and its generated integration user has broad write access to non-system databases on the isolated resource. This Preview-only risk was explicitly accepted with TLS, generated credentials, strict Preview scoping, and a dedicated database as compensating controls. The free Atlas tier has no managed backup capability; Production must use a separately approved resource with tested backup and recovery.

Production-mode API execution now uses the MongoDB-backed shared rate-limit store. Atomic counters are shared across warm and cold Function instances, each approved limiter has its own namespace, TTL cleanup is indexed, and database failures fail closed with a safe 503 response. The existing in-process behavior remains available to local development and tests. Live Preview testing confirmed the shared counter by returning ten login failures followed by `429 RATE_LIMITED` on the eleventh request. The test used one client; further operational observation may confirm behavior across multiple concurrent client paths.

The retained deployment is Vercel target **Preview**, ID `dpl_HoNwvbX144mjwZtyRC333jE8aPQ8`, with stable protected alias `https://arion-health-preview.vercel.app` and generated URL `https://arion-health-portal-9kjl9v4cn-sumnio.vercel.app`. Vercel Deployment Protection requires authenticated access. A permitted non-operational bootstrap deployment was created only to unlock Preview creation. Although `--skip-domain` was requested, Vercel unexpectedly assigned the Production alias; that alias was removed immediately. The bootstrap had no Production environment variables, database connection, secrets, accounts, or application data and was deleted after the real Preview became ready. No Production deployment or alias is retained, and Production environment configuration remains empty.

Live Preview verification passed for `/api/health`, `/`, `/login`, React Router deep links, and same-origin `/api` routing without an `/api/api/` prefix. API CORS returns the exact Preview origin with credentials and rejects an untrusted origin with `403 CORS_DENIED`. Helmet headers, HSTS, frame protection, nosniff, and the absence of `X-Powered-By` were verified. Disposable Patient, Doctor, Staff, and Admin identities completed login, role dashboard, reload/session restoration, and logout flows. Admin completed real TOTP MFA. Authentication and MFA cookies were host-only, HttpOnly, Secure, SameSite=Lax, scoped to `/`, and had future expiry; browser local and session storage remained empty.

Vercel runtime logs showed resolved request IPs in security events, expected authentication/MFA/rate-limit events, and successful MongoDB connections without recurring connection errors. This is consistent with cached connection reuse across warm requests and normal cold starts. Logs were checked for sensitive values and none were detected. The disposable smoke records and newly added limiter counters were deleted by exact generated identity and verified absent; no permanent Preview Admin was created.

The final regression passes 106 frontend tests, 241 backend tests, all 48 Playwright E2E journeys, the production build, and both dependency audits with zero reported vulnerabilities. Milestone 25.3 is complete. Remaining Production blockers are protected Doctor signature object storage/rendering, durable security-log retention/access, a separately approved Production Atlas resource with tested backup and recovery, Production secrets and real clinic configuration, monitoring/alerts, and the final controlled Production deployment.
