# Arion Health Portal

Arion Health Portal contains a React frontend and a Node.js, Express, MongoDB, and Mongoose backend. Authentication plus Patient and Doctor portal features use the backend API. Staff and Admin frontend features still use their mock repositories until their specific migration milestones.

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

Patient profile, booking, appointment, record, and certificate screens and all Doctor screens use live APIs. Staff queue/calendar/walk-in screens and Admin management screens remain mock-backed. Public pages retain their approved design and omit social login, password recovery, and other unapproved features. All live calls use the centralized `src/services/apiClient.js` through feature repository/service adapters.

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
- `POST /api/staff/patients/walk-in`
- `POST /api/staff/patients/:patientId/walk-in-appointments`
- `PATCH /api/staff/appointments/:appointmentId/check-in`
- `PATCH /api/staff/appointments/:appointmentId/priority`
- `PATCH /api/staff/appointments/:appointmentId/no-show`
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

Authentication uses bcryptjs password hashes and a signed JWT in an HttpOnly cookie. The frontend origin must match `CORS_ORIGIN`, and credentialed CORS is enabled for that configured origin. Backend tests use an ephemeral HTTP port and isolated repositories, so they do not require a live database:

```sh
npm test
```

Backend authorization uses reusable authentication, active-account, role, permission, and ownership middleware. Unauthenticated requests return 401; authenticated requests denied by account status, role, permission, or ownership return 403. Admin permissions are limited to account management, Staff permissions remain operational, and Doctor clinical actions still require feature-specific assignment checks. Internal authorization probe routes are disabled during normal API operation.

Patient routes resolve ownership from the authenticated UserProfile and never accept a Patient ID for self-service operations. Appointment creation produces `pending` appointments, uses canonical visit types, and requires an explicitly published, unblocked, unoccupied 30-minute slot within 14 days. Patients may cancel only their own pending or confirmed appointments; cancellation preserves the record. The Staff confirmation endpoint only permits pending-to-confirmed.

Doctor scheduling routes resolve the Doctor from the authenticated UserProfile. Publication is limited to 30 days, must fit an active recurring range, and uses 30-minute boundaries. `CLINIC_TIME_ZONE` defaults to `Asia/Manila`. Optional `CLINIC_OPEN_TIME` and `CLINIC_CLOSE_TIME` remain blank until clinic hours are approved; configure both together to enable server enforcement.

Clinical routes enforce authenticated ownership. Doctors create one immutable MedicalRecord per eligible assigned Appointment, optionally with linked Prescriptions, and may issue immutable certificates with server-generated numbers. Patients can read only their own records and issued certificates. Certificate responses resolve Doctor credentials and shared clinic information without returning the protected signature path. Only the assigned Doctor can complete a confirmed, checked-in consultation after its MedicalRecord exists. Staff and Admin are not clinical superusers.

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

- `src/app`: approved route definitions, router, contextual navigation.
- `src/components`: reusable branding, navigation, and placeholder content.
- `src/layouts`: public layout and shared shell with four role-specific entry points.
- `src/pages`: role-specific placeholder page renderers; split into feature pages in future milestones.
- `src/services`: provider-independent boundary used by the UI.
- `src/mocks`: remaining Staff/Admin preview data and shared legacy fixtures; imported only by mock-backed services.
- `src/styles`: Tailwind entry and responsive layout styling.
- `scripts`: route coverage and navigation checks against the approved sitemap.
- `server/src/config`: environment and MongoDB connection setup.
- `server/src/models`, `server/src/repositories`: Mongoose domain models and persistence adapters.
- `server/src/controllers`, `server/src/routes`: health, authentication, Patient, Doctor scheduling/clinical, Staff operations, and Admin account endpoints.
- `server/src/services`, `server/src/validation`: password/token logic, authorization policy, Patient/appointment business rules, and request validation.
- `server/src/middleware`: authentication, active-account, role, permission, ownership, validation, JSON 404, and centralized error handling.
- `server/test`: backend foundation, model, and authentication tests.

Feature integrations remain behind frontend services. Frontend authentication and all Patient and Doctor portal features are connected to the backend through the centralized credentialed API client. Staff and Admin feature pages still use their mock repositories until their planned migrations. The Doctor integration adds `GET /api/doctor/appointments` for an ownership-scoped schedule/current-consultation projection; it accepts optional `date` and `patient_id` filters and never accepts a client-selected Doctor identity.

Source documents currently live at the repository root (`AGENT.md`, `PROJECT_SPEC.md`, `SCHEMA.md`, `ERD.md`, `SITEMAP.md`), with images in `wireframe/`. See `MILESTONE_1_NOTES.md` for discrepancies. Original approval documents are unchanged.

Production hosting will need an SPA fallback to `index.html` for direct route loads. Deployment is outside this milestone.
