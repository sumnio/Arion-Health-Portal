# Arion Health Portal

Arion Health Portal contains a React frontend and a Node.js, Express, MongoDB, and Mongoose backend. Frontend features still use the current mock repositories; the backend authentication, authorization, Patient profile, and Patient appointment APIs are implemented but have not replaced the mock UI flows.

## Run locally

Use Node.js 24 LTS and npm.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. On Login, enter a sample email and any non-empty sample password, select Patient, Doctor, Staff, or Admin under the mock preview role, and submit. Registration is patient-only, validates required fields, a non-future birth date, and matching passwords, then displays a mock completion message. Form values are not persisted or sent to a backend; no real account or authenticated session is created. Role pages remain accessible previews, not enforced access control.

All detail placeholders remain reachable through mock example links. Public pages follow the approved wireframe structure while omitting unapproved address storage, legal routes, social login, password recovery, and other wireframe-only features. Public styles are scoped to the public layout. Mock authentication behavior lives behind `src/services/authService.js`.

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

Set `MONGODB_URI` in `server/.env` to a development MongoDB connection string. Generate a long random `AUTH_SECRET` for signing authentication JWTs. Keep that file local; `.env` files are ignored by Git. Do not place credentials or a real secret in `.env.example`.

Then run:

```sh
npm run dev
```

The API starts only after `AUTH_SECRET` is configured and MongoDB connects. Available endpoints include:

- `GET /api/health`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/patient/profile`
- `PATCH /api/patient/profile`
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
- `POST /api/staff/patients/walk-in`
- `POST /api/staff/patients/:patientId/walk-in-appointments`
- `PATCH /api/staff/appointments/:appointmentId/check-in`
- `PATCH /api/staff/appointments/:appointmentId/priority`
- `PATCH /api/staff/appointments/:appointmentId/no-show`
- `GET /api/staff/queue`
- `GET /api/staff/patients/:patientId/record-summary`

Authentication uses bcryptjs password hashes and a signed JWT in an HttpOnly cookie. The frontend origin must match `CORS_ORIGIN`, and credentialed CORS is enabled for that configured origin. Backend tests use an ephemeral HTTP port and isolated repositories, so they do not require a live database:

```sh
npm test
```

Backend authorization uses reusable authentication, active-account, role, permission, and ownership middleware. Unauthenticated requests return 401; authenticated requests denied by account status, role, permission, or ownership return 403. Admin permissions are limited to account management, Staff permissions remain operational, and Doctor clinical actions still require feature-specific assignment checks. Internal authorization probe routes are disabled during normal API operation.

Patient routes resolve ownership from the authenticated UserProfile and never accept a Patient ID for self-service operations. Appointment creation produces `pending` appointments, uses canonical visit types, and requires an explicitly published, unblocked, unoccupied 30-minute slot within 14 days. Patients may cancel only their own pending or confirmed appointments; cancellation preserves the record. The Staff confirmation endpoint only permits pending-to-confirmed.

Doctor scheduling routes resolve the Doctor from the authenticated UserProfile. Publication is limited to 30 days, must fit an active recurring range, and uses 30-minute boundaries. `CLINIC_TIME_ZONE` defaults to `Asia/Manila`. Optional `CLINIC_OPEN_TIME` and `CLINIC_CLOSE_TIME` remain blank until clinic hours are approved; configure both together to enable server enforcement.

Clinical routes enforce authenticated ownership. Doctors create one immutable MedicalRecord per eligible assigned Appointment, optionally with linked Prescriptions, and may issue immutable certificates with server-generated numbers. Patients can read only their own records and issued certificates. Certificate responses resolve Doctor credentials and shared clinic information without returning the protected signature path. Only the assigned Doctor can complete a confirmed, checked-in consultation after its MedicalRecord exists. Staff and Admin are not clinical superusers.

Staff operational routes support basic Patient search, guest walk-in registration without an account, same-day confirmed walk-in Appointments, check-in, canonical priority changes, no-show transitions, and the active waiting queue. Queue order is Urgent, Senior/PWD, then Normal, with check-in time ordering inside each tier. Staff has a separate restricted record-summary projection and no consultation-completion or clinical-editing endpoint.

Disposable live validation commands use generated credentials and remove only their own records:

```sh
npm run validate:auth
npm run validate:authorization
npm run validate:patient-api
npm run validate:scheduling
npm run validate:clinical
npm run validate:staff-api
```

## Structure

- `src/app`: approved route definitions, router, contextual navigation.
- `src/components`: reusable branding, navigation, and placeholder content.
- `src/layouts`: public layout and shared shell with four role-specific entry points.
- `src/pages`: role-specific placeholder page renderers; split into feature pages in future milestones.
- `src/services`: provider-independent boundary used by the UI.
- `src/mocks`: preview profiles and navigation IDs; imported only by services.
- `src/styles`: Tailwind entry and responsive layout styling.
- `scripts`: route coverage and navigation checks against the approved sitemap.
- `server/src/config`: environment and MongoDB connection setup.
- `server/src/models`, `server/src/repositories`: Mongoose domain models and persistence adapters.
- `server/src/controllers`, `server/src/routes`: health, authentication, Patient, appointment, and minimal Staff confirmation endpoints.
- `server/src/services`, `server/src/validation`: password/token logic, authorization policy, Patient/appointment business rules, and request validation.
- `server/src/middleware`: authentication, active-account, role, permission, ownership, validation, JSON 404, and centralized error handling.
- `server/test`: backend foundation, model, and authentication tests.

Feature integrations remain behind frontend services. Backend authentication and Patient/appointment APIs are independently testable, while the frontend mock authentication and feature services remain unchanged until their planned migration.

Source documents currently live at the repository root (`AGENT.md`, `PROJECT_SPEC.md`, `SCHEMA.md`, `ERD.md`, `SITEMAP.md`), with images in `wireframe/`. See `MILESTONE_1_NOTES.md` for discrepancies. Original approval documents are unchanged.

Production hosting will need an SPA fallback to `index.html` for direct route loads. Deployment is outside this milestone.
