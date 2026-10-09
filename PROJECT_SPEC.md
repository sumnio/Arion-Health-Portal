# Arion Health Portal

## Backend transition status

The selected backend direction is Node.js, Express, and MongoDB through Mongoose. The backend now includes its foundation, approved models, authentication and authorization foundations, Patient profile and appointment APIs, Doctor scheduling/bookability APIs, clinical record/certificate/Doctor completion APIs, Staff operations APIs, and Admin account-management APIs.

Frontend authentication now uses the backend API through a centralized credentialed HTTP client. Login, Patient registration, logout, session restoration, and protected route guards are real. Patient, Doctor, Staff, and Admin portal feature data use live APIs.

Milestone 22 integration is complete. Production React modules use role-specific API repositories and services over the centralized `apiClient`; they do not import or fall back to legacy mock data. The remaining `src/mocks` and legacy in-memory repositories/services are retained only as deterministic fixtures for pre-integration unit coverage and are excluded from the production module graph.

## HTTP security baseline

The Express API applies Helmet globally before CORS, body parsing, and routes. Helmet's standard protections, including content-type sniffing, frame, referrer, and default Content Security Policy headers, are retained. The API serves JSON rather than frontend HTML, so it does not define a separate complex frontend CSP. `X-Powered-By` remains disabled.

JSON request bodies are limited to `100kb`, which supports the approved authentication, profile, scheduling, appointment, clinical, and account-management payloads without permitting unnecessarily large requests. The API does not consume URL-encoded form bodies, so it does not install an unused URL-encoded parser. Frontend-generated certificate PDFs are downloads derived from authorized JSON responses and are unaffected by the JSON request limit.

Malformed JSON returns `400 INVALID_JSON`, and JSON exceeding the limit returns `413 PAYLOAD_TOO_LARGE`. Both use the centralized safe error envelope, expose no stack trace or internals, and do not terminate the server. Credentialed CORS continues to use the configured frontend origin.

Local and test environments keep HSTS disabled so `localhost` and `127.0.0.1` HTTP development remain usable. Production keeps Helmet's HSTS default. Final HTTPS termination, proxy trust, and HSTS behavior require deployment-level verification before release.

### Targeted abuse protection

The API applies independent IP rate limiters to sensitive write endpoints rather than a global limiter that could disrupt dashboards, schedules, or queue refreshes:

- `POST /api/auth/login`: 10 failed attempts per 15 minutes. Successful logins do not consume this failure budget.
- `POST /api/auth/register`: 5 requests per 60 minutes.
- `POST /api/auth/mfa/verify-setup` and `POST /api/auth/mfa/verify`: one shared budget of 5 failed verification attempts per 10 minutes. Successful verification does not consume the failure budget.
- `POST /api/admin/doctors` and `POST /api/admin/staff`: one shared budget of 20 authenticated Admin provisioning requests per 15 minutes.

Thresholds and windows are configurable through the documented `AUTH_LOGIN_RATE_LIMIT_*`, `AUTH_REGISTER_RATE_LIMIT_*`, `MFA_VERIFY_RATE_LIMIT_*`, and `ADMIN_PROVISION_RATE_LIMIT_*` environment variables. Exceeding a limit returns `429 RATE_LIMITED` with the generic message “Too many requests. Please try again later.” and standard rate-limit/`Retry-After` headers. The response does not identify an account, client IP, or internal limiter key. The frontend replaces all 429 details with the friendly message “Too many attempts. Please try again later.”

Admin authentication, active-account, role, and permission checks run before the provisioning limiter. Rate limiting supplements authorization and never replaces it. Unknown-email, wrong-password, and inactive-account login attempts retain the same `401 INVALID_CREDENTIALS` response until the shared client limit is reached.

Production Vercel execution uses MongoDB-backed atomic counters shared across Function instances, with independent namespaces for each policy and TTL cleanup. Failure of the shared store fails closed with safe `503 RATE_LIMIT_STORE_UNAVAILABLE`; it does not silently remove abuse protection. Local and test execution remain deterministic and do not require the deployment store. The limiters do not add permanent account lockout, password-policy change, or password reset, and Admin TOTP MFA remains separate. Production trusts exactly one proxy hop while local and test execution retain Express's default proxy behavior. Preview verified the shared login budget and proxy-aware resolved client IP; the final Production ingress must repeat this validation before unrestricted public launch.

## Notification backend foundation

The backend provides a shared, recipient-private notification inbox for authenticated active Patient, Staff, Doctor, and fully MFA-authenticated Admin accounts. Each Notification belongs to exactly one `UserProfile` and records that profile's role. Admin has no global notification-browsing authority. Inactive accounts, unauthenticated requests, pre-MFA Admin challenges, and attempts to access another recipient's notification are denied.

The authenticated API exposes `GET /api/notifications`, `GET /api/notifications/unread-count`, `PATCH /api/notifications/:notificationId/read`, and `PATCH /api/notifications/read-all`. Listing is newest first, supports validated `unread_only`, `page`, and `limit` parameters, defaults to 20 items, and caps the limit at 50. Mark-read operations are recipient-scoped, idempotent, and set `read_at` from server time. Responses omit raw recipient identifiers and authentication data.

Notification creation is internal-only through a validated service; there is no `POST /api/notifications` route. The fixed type contract reserves appointment, arrival, urgency, security, and account-status event names for later workflow milestones, but no current booking, arrival, urgent, completion, reminder, or other workflow generates notifications yet. Notification text is short plain operational text only: no HTML, arbitrary metadata, clinical details, urgent explanations, credentials, MFA material, tokens, or environment values. Related-resource navigation is limited to allowlisted appointment, patient, or doctor references and never grants access to that resource. This milestone adds no notification frontend, delivery channel, scheduler, or retention/TTL behavior.

## Clinical API status

The assigned active Doctor may create one MedicalRecord for a confirmed Appointment through `POST /api/doctor/appointments/:appointmentId/medical-record`. Patient and Doctor IDs are resolved from the Appointment and authenticated Doctor; clients cannot choose them. Zero or more validated Prescriptions are created with the MedicalRecord. MongoDB transactions are used when supported, with explicit cleanup fallback for development deployments that do not support transactions.

Doctors may read only records from their own consultations through `GET /api/doctor/patients/:patientId/records` and `GET /api/doctor/records/:recordId`. Patients may read only their own records through `GET /api/patient/records` and `GET /api/patient/records/:recordId`. No MedicalRecord or Prescription edit/delete API exists in the MVP.

`POST /api/doctor/records/:recordId/certificates` directly issues a certificate, matching the approved UI flow. The server generates its unique human-readable certificate number and links the authenticated Doctor, Patient, and MedicalRecord. Patients see only their own issued certificates; Doctors see only certificates they issued. Responses resolve Doctor display name, specialty, license number, PTR number, and signature availability from the Doctor profile, and include shared clinic display configuration without exposing the protected signature path. Issued certificates have no edit/delete API.

`PATCH /api/doctor/appointments/:appointmentId/complete` is restricted to the assigned Doctor. It requires a confirmed, checked-in Appointment and its saved MedicalRecord. Staff, Patient, and Admin roles cannot complete consultations or call clinical creation endpoints.

## Staff operations API status

Staff can search operational Patient information with `GET /api/staff/patients?search=`, open `/staff/patients/:patientId`, register guest walk-ins with `POST /api/staff/patients/walk-in`, and create same-day walk-in Appointments with `POST /api/staff/patients/:patientId/walk-in-appointments`. List results include demographics, portal-link status, and safe latest/upcoming Appointment summaries. The detail response includes safe Patient demographics and newest-first operational Appointment history: date/time, status, Doctor, visit type and reason, arrival, queue priority, and Patient-versus-Staff origin. Walk-in registration creates only a Patient with `user_profile_id = null`; it creates no UserProfile or AuthAccount. Clear matches by contact number or exact name plus DOB are rejected so Staff can reuse the existing Patient identity. Name alone is never treated as a definitive duplicate.

Staff-created walk-in Appointments are immediately `confirmed`, matching the approved Staff UI flow. They use the existing Appointment entity, preserve `Patient.id`, store the authenticated Staff UserProfile in `created_by`, and remain subject to same-Doctor slot uniqueness. Patient self-bookings remain `pending` and visible in the Staff Calendar. The standalone `PATCH /api/staff/appointments/:appointmentId/confirm` transition remains available for compatibility, but routine arrival uses the atomic check-in transition below.

`PATCH /api/staff/appointments/:appointmentId/check-in` is the Staff Confirm Arrival transition. In one conditional database update, it accepts an unchecked `pending` or `confirmed` Appointment on the current clinic day, sets `status = confirmed`, and sets `check_in_at` from trusted server time without overwriting an existing timestamp. `GET /api/staff/queue` returns only confirmed, checked-in Appointments on the current clinic day. Queue order is Urgent, then the shared Senior/PWD tier, then Normal; same-tier ordering uses `check_in_at`. Senior status is derived from DOB and is not stored.

`PATCH /api/staff/appointments/:appointmentId/priority` changes only checked-in confirmed Appointments. Normal to Urgent requires exactly one approved reason: Sudden worsening of condition; Severe pain or discomfort; Breathing difficulty or respiratory concern; Dizziness, weakness, or risk of fainting; Active bleeding or recent injury; Doctor-directed priority; or Other urgent concern. Other requires a bounded explanation. Urgent to Normal requires a bounded correction reason. Each change and its append-only `AppointmentPriorityAudit` event commit in one MongoDB transaction; actor and timestamp are server-derived. Staff may read this history, and only the Doctor assigned to the Appointment may read it through the Doctor route. Patient and Admin receive no urgency-history access.

`PATCH /api/staff/appointments/:appointmentId/no-show` preserves an eligible unchecked pending/confirmed Appointment while changing its status to `no_show`, which removes it from the queue. Staff may perform this explicit action only when trusted server time is at least five minutes after the scheduled start; there is no automatic no-show transition. Doctor completion likewise removes an Appointment from Staff queue results. No Staff completion endpoint exists.

`GET /api/staff/patients/:patientId/record-summary` returns only non-clinical record metadata: Patient name, encounter time, and attending Doctor. It excludes diagnosis, notes, prescriptions, and certificate content.

The live Staff frontend uses `GET /api/staff/appointments?date=YYYY-MM-DD` for operational calendar/day data, `GET /api/staff/doctors` for the active Doctor directory, and `GET /api/staff/patients/:patientId` for Patient demographics plus operational Appointment history. These endpoints expose only the fields needed by approved Staff workflows and no MedicalRecord body. `PATCH /api/staff/appointments/:appointmentId/cancel` preserves the Appointment while allowing Staff to cancel only an unchecked pending or confirmed Appointment.

## Admin account API status

Admin-only `/api/admin/doctors` and `/api/admin/staff` APIs provision linked AuthAccount, UserProfile, and Doctor/Staff records. Roles are assigned server-side, passwords are stored only as bcrypt hashes in AuthAccount, and responses never expose hashes. Doctor and Staff list/detail/update routes return only approved non-clinical administrative fields. Provisioning uses MongoDB transactions when available with rollback cleanup when transactions are unavailable.

Doctor, Staff, and linked Patient portal lifecycle routes explicitly deactivate or reactivate the related UserProfile using only `active` and `inactive`. They preserve the role profile ID, UserProfile ID, AuthAccount, Appointments, created-by references, and clinical history. There are no hard-delete endpoints. Existing active-account authorization immediately denies protected access after deactivation.

`GET /api/admin/patients` and `GET /api/admin/patients/:patientId` return basic Patient/account information only and support name/contact search plus `active`, `inactive`, and `no_account` filters. A Patient with `user_profile_id = null` has no portal lifecycle action; Admin cannot create an account for that walk-in through this milestone. Admin remains unable to read or edit clinical data through account routes.

Current transition:

```text
React -> service layer -> API repositories -> Express API -> MongoDB
                         (authentication, authorization, Patient/appointment, scheduling, clinical, Staff operations, and Admin account APIs implemented)
```

## Patient and appointment backend API

The authenticated Patient API provides:

- `GET /api/patient/profile`
- `PATCH /api/patient/profile`
- `POST /api/patient/appointments`
- `GET /api/patient/appointments`
- `GET /api/patient/appointments/:appointmentId`
- `PATCH /api/patient/appointments/:appointmentId/cancel`
- `PATCH /api/patient/appointments/:appointmentId/reschedule`

Every Patient endpoint requires a valid authenticated session, an active UserProfile with role `patient`, and a Patient linked through `Patient.user_profile_id`. The API never accepts `patient_id` for self-service operations. Profile lookup, appointment list/detail, creation, and cancellation are scoped to that linked Patient. Appointment ownership failures use the same not-found response as missing appointments to avoid exposing another Patient's data.

Patient profile updates support the approved contact and emergency-contact fields, PWD status, and the existing profile workflow's `dob` and `sex` fields. Updating `full_name` or `contact_number` also keeps the linked UserProfile's shared display/contact values synchronized. Identifiers, account status, role, allergies, and clinical data cannot be changed through this endpoint.

Patient appointment creation accepts only `doctor_id`, `appointment_at`, canonical `visit_type`, and the schema-required `reason`. Patient self-booking uses the approved visit-reason labels; selecting `Other concern` requires details and stores the normalized value as `Other concern: [trimmed text]`. Staff walk-in creation retains its existing free-text reason behavior. The server derives the Patient, sets `created_by` to the authenticated Patient UserProfile ID, sets `status = pending`, `priority = normal`, and `check_in_at = null`, enforces future 30-minute slot boundaries and the approved 14-day Patient booking window, and maps the active same-Doctor/time unique-index collision to HTTP 409. Clients cannot choose or override the creator identity.

Patients may cancel only their own future `pending` or `confirmed` appointments before check-in and before a MedicalRecord has been saved for the consultation. Cancellation changes the status to `cancelled` and preserves the document. Checked-in, recorded, completed, cancelled, and no-show appointments reject cancellation. This prevents a completed clinical encounter from being cancelled even if its shared Appointment status has not yet been updated to `completed`.

Patients may reschedule only an owned Appointment originally created by their authenticated Patient account. The original Appointment must be `pending` or unchecked `confirmed`, have no MedicalRecord, and remain at least 60 minutes away; exactly 60 minutes is allowed. `PATCH /api/patient/appointments/:appointmentId/reschedule` accepts only `appointment_at`, keeps the same Appointment ID, Patient, Doctor, visit type, reason, priority, and `created_by`, and resets status to `pending`. The target is revalidated against the trusted current time, 30-minute boundary, clinic-local 14-day horizon, published availability, blocked time, configured clinic hours, and the existing unique Doctor/time constraint. No dedicated reschedule history is stored.

The Staff lifecycle action `PATCH /api/staff/appointments/:appointmentId/confirm` requires an active Staff account and permits only `pending -> confirmed`. The backend also implements the approved check-in, queue, no-show, priority, and walk-in operations. Consultation completion remains Doctor-owned.

Server-side booking requires date-specific DoctorPublishedAvailability, removes DoctorBlockedTime overlaps and active occupied slots, and applies configured clinic hours when present. The existing MongoDB partial unique index remains the final concurrency guard against same-Doctor active slot collisions. Patient booking, Doctor scheduling, Staff operations, and Admin account management use live APIs.

## Staff-managed Doctor scheduling and bookability backend API

Authenticated Doctors read only their own schedule through the first three routes below. Active Staff manages schedules for active Doctors through the remaining routes:

- `GET /api/doctor/availability`
- `GET /api/doctor/published-availability`
- `GET /api/doctor/blocked-times`
- `GET /api/staff/doctors/:doctorId/schedule`
- `POST /api/staff/doctors/:doctorId/availability`
- `PATCH`, `DELETE /api/staff/doctors/:doctorId/availability/:availabilityId`
- `POST /api/staff/doctors/:doctorId/published-availability`
- `DELETE /api/staff/doctors/:doctorId/published-availability/:publishedId`
- `POST /api/staff/doctors/:doctorId/blocked-times`
- `DELETE /api/staff/doctors/:doctorId/blocked-times/:blockedTimeId`

Doctor reads resolve ownership from the authenticated UserProfile. Staff mutations take the target Doctor only from the validated path and reject inactive or missing Doctors; request bodies cannot set Doctor identity or other protected fields. Multiple non-overlapping recurring ranges on one weekday are supported. Date-specific publication must be today through 30 days ahead, align to 30-minute boundaries, remain within one active recurring range, and not overlap another published range for that Doctor/date. Active schedule lists hide past published dates, current-day publications after their clinic-local end time, and blocked periods whose `end_at` is not later than server time without deleting the stored records. Successful Staff mutations emit redacted structured operational events with actor, target Doctor, action, record, outcome, and timestamp; blocked reasons and request bodies are not logged.

Patients retrieve bookable times through `GET /api/patient/doctors/:doctorId/available-slots?date=YYYY-MM-DD`. Recurring availability alone never produces Patient slots. Slot generation starts from explicitly published ranges, removes past times and DoctorBlockedTime overlaps, and returns appointments in the blocking statuses `pending`, `confirmed`, and `completed` only as anonymous occupied slots with `available: false`; Patient booking and rescheduling display those times but disable selection. The Patient date must be within the 14-day horizon. `POST /api/patient/appointments` applies the same availability calculation before persistence, while the MongoDB partial unique index handles concurrent same-Doctor slot attempts.

DoctorBlockedTime accepts timestamp intervals for partial-day or whole-day blocks. A new block that overlaps an active existing Appointment is rejected with HTTP 409; the Appointment is never cancelled, moved, or deleted. Removing recurring, published, or blocked schedule records also leaves Appointment history intact.

Scheduling uses `CLINIC_TIME_ZONE`, currently defaulting to the centralized development assumption `Asia/Manila`. DoctorPublishedAvailability stores a date-only value normalized to UTC midnight plus clinic-local `start_time` and `end_time`. Appointment and DoctorBlockedTime values are absolute timestamps. `CLINIC_OPEN_TIME` and `CLINIC_CLOSE_TIME` form an optional configuration boundary and must be supplied together as ordered 30-minute `HH:MM` values. Their exact production values remain TBD; when blank, no invented clinic-hours restriction is applied.

## Purpose
Arion Health Portal is a clinic management and patient portal system.

## Roles
- Patient
- Doctor
- Staff
- Admin

## Authentication, registration, and authorization

`/login` is the single shared public login route for Patient, Doctor, Staff, and Admin. The final form uses the user's real account credentials and does not ask the user to select a role. After successful authentication, the application reads the trusted linked UserProfile to determine role and account status.

The Express backend owns account email and password hashes in a dedicated AuthAccount model. Passwords and password hashes must not be stored in UserProfile, Patient, Doctor, or Staff. UserProfile stores application identity, the approved role, common contact information, and account status.

Authentication uses a server-signed JWT stored in the `arion_auth` HttpOnly cookie. The cookie uses `SameSite=Lax`, an eight-hour expiration, and `Secure` in production. The JWT is not stored in browser localStorage. `AUTH_SECRET` is required when the API starts and must remain outside source control.

Admin accounts require TOTP MFA. Correct Admin email/password credentials create only a separate ten-minute HttpOnly `arion_mfa_challenge` cookie and return `MFA_SETUP_REQUIRED` or `MFA_REQUIRED`; this pre-authentication state cannot access `/admin/*` or any protected API. First-time enrollment uses `POST /api/auth/mfa/setup` and `POST /api/auth/mfa/verify-setup`. Later logins use `POST /api/auth/mfa/verify`. Only successful MFA verification consumes the challenge and issues `arion_auth`. Patient, Doctor, and Staff login remains password-only.

Admin TOTP secrets are generated and verified through `otplib`, encrypted at rest with AES-256-GCM and a separate `MFA_ENCRYPTION_KEY`, excluded from APIs, and never logged. Verification accepts six-digit codes with one 30-second step of clock tolerance and allows five failed attempts per ten minutes. Consumed, invalid, and expired challenges are rejected. QR and manual enrollment keys appear only during initial setup. Recovery codes and self-service MFA reset are explicitly deferred; a lost authenticator requires controlled offline operator recovery.

The backend authentication endpoints are `POST /api/auth/register`, `POST /api/auth/login`, the three Admin MFA endpoints, `POST /api/auth/logout`, and `GET /api/auth/me`. Registration is Patient-only, shared login resolves the trusted linked UserProfile, inactive accounts receive the same generic credentials error as other login failures, logout clears both authentication cookies, and `/api/auth/me` returns only safe profile fields.

`/register` is Patient self-registration only. Public registration must create only Patient access and must not accept a client-selected Doctor, Staff, or Admin role. Admin provisions Doctor and Staff accounts through approved account-management workflows. The Admin account is provisioned separately and does not use public registration. Patients cannot promote their own role.

Approved UserProfile roles remain only `patient`, `doctor`, `staff`, and `admin`. After successful login, navigation redirects are:

- `patient` -> `/patient/dashboard`
- `doctor` -> `/doctor/dashboard`
- `staff` -> `/staff/dashboard`
- `admin` -> `/admin/dashboard`

Role redirects are navigation only and are not an authorization control. Every protected route must verify that the user is authenticated, the linked UserProfile status is `active`, and the UserProfile role is allowed for the route:

- `/patient/*` -> Patient only
- `/doctor/*` -> Doctor only
- `/staff/*` -> Staff only
- `/admin/*` -> Admin only

Unauthenticated users attempting a protected route are redirected to `/login`. Authenticated users with the wrong role are sent to `/unauthorized` or denied access. An inactive account must not receive normal authenticated portal access. Deactivation continues to preserve historical records and relationships.

Authentication answers who the user is; role-based authorization determines what the user may do. Frontend route guards must later be combined with backend authorization and database-enforced access controls. Supabase RLS may provide part of those controls when Supabase is selected. Hiding routes or buttons is not sufficient security.

The frontend uses these backend authentication endpoints through its service layer. Every request includes credentials so the browser can send the HttpOnly cookie. Application startup calls `/api/auth/me` before protected content renders; a normal initial `401` becomes guest state. Login redirects by the trusted returned UserProfile role, protected route groups enforce the matching active role, and logout clears frontend state even when the server session has already expired. The former mock role selector, preview login, and “Exit mock preview” controls have been removed.

The frontend never reads or stores the JWT, MFA challenge, or TOTP secret in localStorage or sessionStorage. The login page holds only the current in-memory Admin MFA step, renders the enrollment QR with `qrcode`, and does not treat MFA-pending state as authenticated. Password recovery and email verification remain later work. Patient, Doctor, Staff, and Admin feature repositories use the live API.

### Backend authorization foundation

Protected backend actions follow this order: validate the JWT cookie, resolve a safe UserProfile, require `status = active`, require an approved role or permission, then apply a resource ownership check when the feature requires it.

- Missing, invalid, or expired authentication returns `401 UNAUTHENTICATED`.
- A valid authenticated account with the wrong role or failed ownership check returns `403 FORBIDDEN`.
- A valid cookie whose UserProfile has since become inactive returns `403 ACCOUNT_INACTIVE`.
- Authorization context contains only `user_profile_id`, `display_name`, `role`, and `status`; it never includes credentials or password hashes.

The approved foundation permissions are:

| Role | Foundation permission scope |
|---|---|
| Patient | Patient self-service; later feature routes must also verify Patient ownership |
| Doctor | Doctor portal, MedicalRecord creation, certificate issuance, and consultation completion subject to assignment/ownership and workflow rules |
| Staff | Operational Staff workflows only; no record creation, certificate issuance, or consultation completion |
| Admin | Account management only; Admin is not a clinical superuser |

Only the Doctor assigned to an Appointment may complete its consultation. The role policy admits Doctors to that future action, while the feature endpoint must also resolve the Appointment and apply the ownership helper against the assigned Doctor. No consultation-completion endpoint is added in this milestone.

Authorization probe routes used by automated and live validation are disabled by default and are not normal feature APIs.

## Core MVP

### Patient
- Register/login
- Book appointment
- View appointments
- View medical records
- View medical certificates
- Manage profile

### Doctor
- View schedule
- View own recurring availability, active publications, and current/future blocked time read-only
- View patient information
- Create medical records
- Mark an assigned eligible consultation completed after its MedicalRecord has been saved
- Issue medical certificates

### Staff
- View the Staff Dashboard
- View and manage the clinic calendar and appointment operations
- View active Doctors and manage each Doctor's schedule through the dedicated Doctors workflow
- Search existing patients and register walk-in patients
- Create same-day walk-in appointments
- Check in patients and manage the queue

## Staff permissions

Staff access follows least-privilege principles and is limited to clinic operations plus the approved limited medical-record summary.

### Operational access

Staff may:

- view the Staff Dashboard;
- view and manage the clinic calendar;
- view active Doctors at `/staff/doctors` and manage one Doctor's working hours, booking dates, and time off at `/staff/doctors/:id/schedule`;
- view operational appointment details;
- confirm eligible appointments;
- cancel eligible appointments when appropriate;
- search existing patients;
- view basic patient information needed for appointment, walk-in, check-in, and queue workflows;
- register walk-in patients and create their same-day Appointments;
- check in eligible patients and manage the queue; and
- mark eligible unattended appointments as no-show.

These permissions must continue to follow the approved Appointment and queue rules. Staff pages must not be used to edit clinical history or mark a consultation completed. Completion is owned by the Doctor assigned to the Appointment.

### Limited read-only medical-record visibility

When operationally necessary, Staff may view only:

- patient name;
- encounter date;
- attending doctor; and
- short diagnosis summary.

Staff must not view detailed doctor notes, full prescription details, MedicalCertificate contents, or sensitive clinical narrative beyond the approved short diagnosis summary. More detailed clinical information remains Doctor-only.

### Prohibited actions

Staff must not create, edit, or delete MedicalRecords; create or edit Prescriptions; issue, edit, or delete MedicalCertificates; modify Doctor clinical decisions; edit patient clinical history; or manage Doctor, Staff, or Admin accounts.

## Consultation completion

Only the Doctor assigned to an Appointment may mark its consultation `completed`. In the normal scheduled and walk-in flow, the Doctor first saves the linked MedicalRecord and then explicitly confirms completion. A `cancelled`, `no_show`, or already `completed` Appointment cannot be completed again. Saved MedicalRecords remain read-only.

Staff may observe the shared Appointment status but may not set it to `completed`. Completion removes the checked-in patient from the active waiting queue and must appear consistently in Doctor schedule/detail views, Staff dashboard/calendar/queue views, and the Patient's appointment list/detail. The system uses the existing Appointment `status`; it must not create separate Doctor and Staff completion fields.

These restrictions must later be enforced by backend authorization and database access policy. Supabase RLS is one possible enforcement mechanism. Hiding UI controls is not sufficient.

### Admin
- Manage doctors
- Manage staff
- View Patient account information and deactivate/reactivate Patient portal access through `/admin/patients`
- Deactivate/reactivate Doctor accounts, Staff accounts, and Patient portal access; never delete historical clinical data

## Admin Patient account management

`/admin/patients` is the approved Admin route for Patient portal-account administration. It does not grant clinical management access.

Admin may view only the basic information needed for account administration:

- `Patient.full_name`;
- Patient or linked UserProfile contact number as appropriate;
- linked `UserProfile.status` (`active` or `inactive`);
- basic account/profile identifiers needed to preserve the Patient-to-UserProfile link; and
- `UserProfile.created_at` as the account creation date when a portal account exists.

A Patient with `user_profile_id = null` has no portal account. This is not an additional account status; `active` and `inactive` remain the only UserProfile statuses.

Admin may deactivate an active Patient portal account by setting its existing UserProfile status to `inactive`, and may reactivate that same account by returning the status to `active`. Deactivation prevents portal/account access only. It must not unlink or hard-delete the Patient or UserProfile.

The same `Patient.id` must be preserved during deactivation, reactivation, and appropriate relinking of a returning Patient. Do not create a second Patient or medical-history identity. Appointment, MedicalRecord, Prescription, and MedicalCertificate history and relationships must remain intact.

Admin must not create or edit MedicalRecords, diagnoses, doctor notes, Prescriptions, or MedicalCertificates; issue certificates; alter Doctor clinical decisions; or permanently delete Patient clinical history.

Future backend authorization and database access controls must enforce this account-only boundary. Supabase RLS is one possible enforcement mechanism. Hiding clinical controls in `/admin/patients` is not sufficient.

## Doctor profile and clinical document rules

- Doctor contains `id`, `specialty`, `license_number`, `ptr_number`, and `signature_path` only.
- Doctor display name, contact number, and account status come from the linked UserProfile. Do not duplicate them in Doctor or add password/username fields.
- Doctor license and PTR numbers will later be displayed on issued medical certificates.
- `signature_path` references the doctor's signature image, which must be stored in protected object/file storage, such as Supabase Storage when that provider is selected. Do not store image binary in Doctor.
- Saved medical records and issued medical certificates remain read-only.
- Active Staff manages schedules for active Doctors under the scheduling rules below. Doctors retain read-only visibility of their own schedule.

## Medical certificate rules

MedicalCertificate contains `id`, unique `medical_certificate_number`, `patient_id`, `doctor_id`, nullable `medical_record_id`, `date_issued`, `purpose`, `diagnosis_summary`, nullable `valid_until`, `status`, `created_at`, and `updated_at`. Status is limited to `draft` and `issued`. The exact certificate-number format is not yet finalized.

Certificate display/generation must show the linked Doctor's license number, PTR number, and signature image, plus the clinic location. License and PTR values come from `Doctor.license_number` and `Doctor.ptr_number`; the signature image comes through `Doctor.signature_path`. Do not duplicate these values in MedicalCertificate for the current MVP.

`Doctor.signature_path` stores only a protected path/reference. The raw image binary is not stored in Doctor. The image must be stored in protected object/file storage and must not be publicly exposed outside the intended certificate flow.

Clinic location is simple application/global configuration used only for certificate display/generation. Do not create a clinic-management system or add clinic location to MedicalCertificate.

Draft certificates may exist only during the approved Doctor creation flow at `/doctor/records/:id/certificate/new`. Once issued, a certificate is read-only: the MVP provides no Edit, Update, Delete, Reissue, or Modify action. Patients and Staff cannot edit certificates, Admin cannot edit certificate clinical content, and Doctors issue certificates only through the approved flow.

When `medical_record_id` is present, it links to the related MedicalRecord. Patient and Doctor relationships must always be preserved.

Issued certificates can be downloaded as PDFs from the authenticated Doctor issuance success state and Patient certificate-detail view. The current frontend generates the PDF from the authorized certificate API response without a public route or external PDF service. QR verification, public certificate verification, external sharing, advanced digital-signature infrastructure, payment integration, and server-side PDF generation remain future scope.

## Doctor scheduling

DoctorAvailability stores `id`, `doctor_id`, `day_of_week`, `start_time`, `end_time`, and `is_active` for recurring weekly hours. A doctor may publish multiple availability ranges on the same day. For example, 9:00 AM-12:00 PM and 1:00 PM-5:00 PM leaves a recurring lunch break between the ranges. This is the preferred representation for a regular lunch break or other recurring break; it does not require DoctorBlockedTime.

DoctorPublishedAvailability stores the specific dates and time ranges the Doctor has actually confirmed for patient booking. It is distinct from the recurring DoctorAvailability template. Its Mongoose fields are `id`, `doctor_id`, `availability_date`, `start_time`, `end_time`, `created_at`, and `updated_at`.

DoctorBlockedTime stores `id`, `doctor_id`, `start_at`, `end_at`, and `reason` for one-time or temporary whole-day and partial-day exceptions. Examples include leave, a meeting, a conference, clinic closure, an emergency absence, a personal break, a temporary lunch-time change, or another one-time unavailable period.

### Scheduling and publication rules

- Appointment slots are fixed at 30 minutes.
- Staff manages recurring availability, date-specific publication, and blocked time through Staff-only APIs. `/doctor/schedule` is read-only.
- A doctor may publish multiple DoctorAvailability ranges for the same day. Gaps between ranges represent regular recurring breaks.
- A doctor may publish availability up to 30 days ahead and is not required to publish all 30 days. Patients may see and book only dates/times actually published by the doctor; a recurring weekly row alone does not publish every matching future date.
- Exact clinic operating hours are TBD and must be configurable. Do not hardcode clinic-hour values. Once configured, DoctorAvailability and every bookable 30-minute slot must remain within those hours.
- DoctorBlockedTime overrides regular DoctorAvailability. Any slot overlapping blocked time is unavailable, including when only part of a day is blocked.
- Already-booked slots are unavailable for new booking. The same doctor must not have two active appointments in the same time slot or overlapping appointment intervals. Different doctors may have appointments at the same time.

Bookable slot logic: Published DoctorAvailability within the patient's next 14 days and configured clinic operating hours - DoctorBlockedTime - already-booked appointment slots = available 30-minute patient booking slots.

### Unresolved implementation details

The approved DoctorAvailability fields describe weekly recurrence and do not record specific published dates. `is_active` enables/disables a weekly period; it must not be treated as proof that all dates in the next 30 days were published. DoctorPublishedAvailability records those date-specific ranges through a required Doctor reference, date, and ordered start/end times.

Clinic operating-hour values remain intentionally TBD. The backend configuration boundary is now `CLINIC_OPEN_TIME` and `CLINIC_CLOSE_TIME`; both are optional and must be configured together. No fixed values or additional scheduling entity are introduced here.

The approved patient booking window is up to 14 days ahead. The doctor publication limit remains 30 days and must not be used as the patient booking limit.

Appointment `created_by` is a nullable reference to `UserProfile.id` and identifies the authenticated account that originally created the Appointment. Patient self-booking records the Patient UserProfile ID. The future Staff walk-in API must record the authenticated Staff UserProfile ID. Imported, system-generated, or legacy Appointments may use null when no authenticated creator is available. The creator is independent of the Patient receiving care (`patient_id`) and Doctor assigned to the consultation (`doctor_id`). Account deactivation preserves this historical reference; it must not null the field or delete the Appointment.

### Patient appointment booking rules

Patient booking is limited to up to 14 days ahead. Doctor publication remains up to 30 days ahead; doctors need not publish all 30 days. Publication beyond the patient window does not make those dates bookable by patients yet.

A patient slot is bookable only when all conditions hold:

1. The date is within the next 14 days.
2. The selected doctor has actually published availability for that date/time.
3. The full 30-minute slot falls within that published availability and, once defined, the configured clinic operating hours.
4. The slot does not overlap DoctorBlockedTime.
5. No other active appointment occupies that doctor's slot.

The same doctor must not have two active appointments in the same 30-minute slot. Different doctors may have appointments at the same time.

### Fixed MVP visit types

- General Consultation
- Follow-up
- Check-up

These are the only approved fixed MVP visit types. Appointment stores them in `visit_type` using canonical values `general_consultation`, `follow_up`, and `check_up`. Do not create a Service or Department table or conflate visit type with the separate reason for visit. Patient self-booking uses the approved reason dropdown (plus detailed `Other concern`); Staff walk-in reason entry remains free text.

### Normal walk-in appointment flow

Staff selects an existing Patient or registers a new walk-in Patient, creates a same-day Appointment, and checks the patient in. The patient enters the queue and the doctor consults through the normal appointment flow. MedicalRecord normally links to that Appointment through appointment_id. A portal account is not required. Nullable appointment_id remains for exceptional/manual records, not the normal walk-in flow.

## Queue and check-in rules

Queue priority is:

1. Urgent
2. Senior / PWD
3. Normal

- Senior and PWD share one tier. A patient who is both Senior and PWD receives no double priority.
- Senior status is derived from `Patient.dob`; do not store or manually assign `is_senior`. PWD status comes from `Patient.is_pwd`.
- Pregnancy does not require a separate queue priority or status. A case that qualifies as urgent under clinic policy uses the existing urgent Appointment priority; otherwise the standard derived tier applies.
- Appointment priority values remain only `normal` and `urgent`. Senior/PWD is derived for queue ordering and is not a new stored Appointment priority.
- Within the same tier, earlier `check_in_at` goes first. If a fallback is needed because `check_in_at` is unavailable, use `appointment_at` consistently. Do not order the queue by Appointment creation time.
- Only eligible current-clinic-day Appointments may confirm arrival. `pending` and `confirmed` may be eligible; `cancelled`, `completed`, and `no_show` are not eligible.
- Confirm Arrival atomically sets `status = confirmed` and `check_in_at` from server time, adding the patient to the waiting queue. A non-null `check_in_at` prevents duplicate arrival confirmation and must not be overwritten.
- Walk-ins use the same logic after staff creates their same-day Appointment and checks them in: Urgent -> Senior/PWD -> Normal, then earlier check-in first within the tier.
- The approved model has no separate queue entity or additional queue priority values.


## Shared profile and account lifecycle

- UserProfile contains `id`, `display_name`, `role`, `contact_number`, `status`, `created_at`, and `updated_at`.
- Roles are limited to `patient`, `doctor`, `staff`, and `admin`. Account statuses are limited to `active` and `inactive`.
- Use deactivation instead of hard deletion. Inactive accounts must not be allowed to log in or retain application access. Admin may later reactivate the same account.
- Deactivation preserves UserProfile and related Patient, Doctor, and Staff records. Historical appointments, medical records, prescriptions, certificates, and their relationships remain intact; account lifecycle must not cascade-delete them.
- Reactivating or relinking account access for a returning Patient must reuse the existing `Patient.id`; do not create a second medical-history identity.
- For account holders, shared display name and contact number belong in UserProfile. Keep `Patient.contact_number` in Patient for walk-ins without accounts.
- Passwords, including password hashes, must not be stored in UserProfile, Patient, Doctor, or Staff. The selected authentication system handles credentials. Do not add username fields to Doctor or Staff.

## Patient identity and portal account linking

- Patient stores `full_name`, `dob`, `sex`, `contact_number`, optional `address`, `allergies`, and `is_pwd` independently of a portal account.
- Emergency contact information uses three optional fields: `emergency_contact_name`, `emergency_contact_number`, and `emergency_contact_relationship`.
- Senior status is derived from `dob`; do not store `is_senior` or allow manual selection.
- Staff may register walk-in patients without portal accounts. These patients have their own `Patient.id` and `user_profile_id = null`.
- If a returning walk-in later receives a portal account, an authorized process verifies their identity and links the new patient-role UserProfile through `Patient.user_profile_id`. Keep the existing `Patient.id` rather than creating a replacement Patient.
- Existing appointments, medical records, and certificates remain linked to the same Patient through `patient_id`.

## Backend portability

The selected backend direction is an Express + Node.js API backed by MongoDB/Mongoose. The React frontend uses service/API repository abstractions so UI components do not contain direct database or transport logic.

Authentication, active-account checks, role authorization, ownership checks, least-privilege access, history preservation, and protected signature access are provider-independent requirements. Supabase RLS may enforce database access when Supabase is selected; an Express implementation must enforce equivalent checks in the API and persistence layers.

The Mongoose models map the approved entities to separate collections and ObjectId references. Backend feature APIs and frontend authentication are active. Patient dashboard, profile, booking, appointment, record, and certificate pages use the authenticated Patient API. Doctor navigation is limited to Dashboard, read-only My Schedule, and Patients. The Doctor Patients page derives a unique list only from the authenticated Doctor's assigned appointments returned by `GET /api/doctor/appointments`; it is not a clinic-wide Patient directory. Patient Detail uses Overview, Consultation, Medical Records, and Certificates tabs while retaining the existing relationship checks, clinical actions, immutable history, and certificate restrictions. Doctor medical-record/prescription creation, certificate issuance/view, and completion continue to use the authenticated Doctor API. `GET /api/doctor/appointments` supplies the minimal ownership-scoped assigned-appointment projection required by the Doctor routes, with optional date and Patient filters. Staff dashboard, calendar, queue, Patient search, walk-in registration/appointment creation, and approved operational actions use authenticated Staff APIs. Admin dashboard and Doctor, Staff, and Patient account-management pages use authenticated Admin APIs.

## Clinic Analytics (v1.1)

Active Staff and MFA-authenticated Admin may open their role-scoped Analytics page. `GET /api/staff/analytics?period=today|week|month` and `GET /api/admin/analytics?period=today|week|month` share one read-only aggregation service while retaining separate route authorization. Patient and Doctor roles have no clinic-wide analytics access.

The backend defines Today, Monday-through-Sunday This Week, and calendar This Month in `Asia/Manila` and returns the authoritative inclusive start date and exclusive end date. Metrics are calculated at request time from existing Appointment, Patient, and Doctor data. No analytics collection, writeback, cache document, monthly counter, schema field, migration, or new index exists.

The response contains appointment totals and exact status counts; Doctor appointment volume, unique Patients, unique Patients served by completed consultations, outcomes, and current Urgent volume; stored visit-type counts; approved standardized visit-reason counts with all other/free-text reasons grouped as `Other / legacy`; unique Senior, PWD, and combined Patients with completed appointments; and busiest clinic-local scheduled weekday and 30-minute time slot. Tied busiest weekdays choose the earliest Monday-through-Sunday clinic week day, while tied time slots choose the earliest scheduled slot. Active Doctors with zero selected-period activity remain visible; a Doctor with historical selected-period activity remains represented even if no longer active. Doctor workload is operational volume and never a performance score.

Analytics responses contain counts, metric definitions, period metadata, and Doctor display names only. They contain no Patient names, raw Patient identifiers, MedicalRecord content, diagnosis, notes, Prescriptions, certificate content, free-text urgency explanations, or raw free-text visit reasons. New-versus-returning Patients and urgency-reason distribution are deferred because neither is required for the initial safe aggregate view.

## Backend input-validation and authorization baseline

Milestone 23.3 completed an audit of every mounted backend route, mutation allowlist, protected field, role boundary, ownership check, list filter, and appointment state-transition endpoint. The approved responsibilities and product behavior remain unchanged.

- Every request body, query value, and route parameter is untrusted. API mutations accept only explicit fields for that operation; unknown fields and server-owned identity, ownership, role, lifecycle, appointment-status, certificate-number, and credential fields are rejected.
- ObjectId route and body values are validated before repository access. Date, time, enum, boolean, and text values are normalized and validated at the API boundary. Object or array values are rejected where a scalar is required, preventing operator-style query input from reaching MongoDB.
- Input sizes are bounded in addition to the global `100kb` JSON-body limit. Search strings are limited to 100 characters, list page size is capped at 50, passwords at 128 characters, prescriptions and allergies at 20 entries, and free-text fields use reasonable field-specific bounds.
- State-transition actions whose meaning is defined by the route accept no client fields. The server alone determines cancellation, confirmation, check-in, no-show, consultation completion, account activation/deactivation, and deletion of owned scheduling ranges.
- Raw HTTP bodies and query objects must never be passed into Mongoose. Services provide validated and normalized fields; repositories use explicit projections and update objects.
- Authentication, active status, role/permission, ownership, and state-transition eligibility are enforced independently. Patients remain limited to their own resources; Doctors remain limited to their own schedules and assigned consultations; Staff retains only approved operational and limited record-summary access; Admin remains limited to account management.
- Saved MedicalRecords and Prescriptions, and issued MedicalCertificates, remain immutable through the public API. No update or delete endpoint is provided for them.
- Validation errors use safe structured responses. Unexpected failures return a generic error and must not reveal stack traces, database internals, credentials, password hashes, authentication secrets, or protected signature paths.

## Secrets, CORS, and authentication-cookie baseline

- Backend credentials and secrets belong only in ignored `server/.env` during local development or in the deployment platform's secret store. `MONGODB_URI`, `AUTH_SECRET`, `MFA_ENCRYPTION_KEY`, Admin bootstrap credentials, password hashes, and private credentials must never be exposed through frontend environment variables, API responses, logs, or documentation examples.
- Non-test runtime requires a non-placeholder `AUTH_SECRET` of at least 32 characters and a base64-encoded 32-byte `MFA_ENCRYPTION_KEY`. Missing or invalid secrets fail startup safely; the API must never generate runtime secrets automatically. `NODE_ENV` is limited to `development`, `test`, and `production`.
- `CORS_ORIGIN` is an explicit comma-separated allowlist of origin-only HTTP(S) URLs. Credentialed wildcard CORS is prohibited. Trusted browser origins are echoed individually; untrusted browser origins receive a safe denial without allowlist details. Requests without an Origin header remain supported for health checks, API tools, and server-to-server clients. Production requires an explicit trusted origin.
- The frontend may expose `VITE_API_BASE_URL` because an API origin is public. No backend secret, MongoDB URI, password, private key, Admin credential, or authentication token may use a `VITE_` variable.
- The `arion_auth` cookie remains HttpOnly, host-only, `SameSite=Lax`, `Path=/`, and expires after eight hours. It uses `Secure=false` for local/test HTTP and `Secure=true` in production. Logout clears the cookie with matching security and scope attributes. The JWT remains unavailable to browser JavaScript and is not stored in localStorage or sessionStorage.
- The short-lived `arion_mfa_challenge` cookie uses the same HttpOnly, host-only, SameSite, path, and environment-aware Secure settings, but expires after ten minutes and has a distinct JWT audience/purpose. It cannot authorize protected routes and is cleared after successful MFA or logout.
- Production requires HTTPS and correctly configured TLS termination. Cookie Domain and Express `trust proxy` remain unset until the actual hosting and proxy topology is known; neither may be guessed or enabled broadly in advance.

## Security-event logging baseline

- The API emits machine-readable server-side JSON security events for login success/failure, Admin MFA setup start/completion, MFA verification success/failure and rate limiting, logout, inactive-account denial, rate-limit triggers, role/permission/ownership denials, Admin Doctor/Staff provisioning, account deactivation/reactivation, and security-relevant protected-field or operator-style input rejection. Normal reads, ordinary form mistakes, expected conflicts, and not-found responses are not security events.
- Events use stable uppercase names and a small `info`, `warning`, and `critical` severity set. The normalized shape may include timestamp, event, outcome, authenticated UserProfile ID and role, safe target type/ID, route, method, direct request IP, and minimal metadata.
- The logger allowlists top-level event fields and recursively redacts dangerous metadata keys. Passwords and hashes, JWTs, cookies, authorization headers, MFA secrets/codes/challenges/QR URIs, authentication secrets, MongoDB URIs, private keys, raw email credentials, full request bodies, signature paths, diagnoses, notes, prescriptions, and certificate content must never be logged.
- Failed login events use one generic reason category and do not distinguish unknown email, wrong password, or inactive account. This preserves the existing generic client behavior and avoids account-enumeration details.
- Logging is best-effort and must never crash or block the observed request. MVP logs go to structured server output; no MongoDB log collection or clinical audit trail is introduced.
- IP values use Express's resolved `request.ip`. Production-mode Vercel execution trusts one proxy hop; Preview verified resolved forwarded IPs in runtime security events. The final Production ingress must repeat that validation. External log transport, retention, access policy, alerting, and SIEM integration remain deployment and operations work.

## Dependency-security baseline

- The 2026-09-27 dependency audit checked the frontend and backend manifests and lockfiles independently with `npm audit`. Both reported zero known vulnerabilities: 0 critical, 0 high, 0 moderate, and 0 low.
- Every direct frontend and backend package has confirmed code, build, test, or development usage. Milestone 23.7 added maintained `otplib` for RFC-compatible TOTP generation/verification and `qrcode` for enrollment QR rendering; neither package reports a deprecation marker.
- Both installed dependency trees pass `npm ls --depth=0`. Direct package metadata reports recognized permissive licenses and no deprecation markers. This is a point-in-time result and must be repeated as advisories and package metadata change.
- Milestone 23 changed the root and server lockfiles only for reviewed MFA dependencies and their transitive packages. Milestone 24.1 subsequently added `@playwright/test` as a root development dependency for browser E2E infrastructure. The post-install frontend and backend audits report zero known vulnerabilities. Unrelated framework upgrades remain deferred to a separately tested maintenance update.
- Keep `package-lock.json` and `server/package-lock.json` committed and synchronized. Prefer necessary compatible patch/minor security fixes, assess runtime reachability and dev-only exposure, and document anything unsafe to upgrade immediately. Never use `npm audit fix --force` or accept breaking major upgrades without explicit review and regression validation.

## Final security regression baseline

Milestone 23 is complete. The final regression pass covers Milestones 23.1–23.7 as one integrated security boundary: Helmet and request limits, targeted abuse throttling, strict allowlist validation, authentication and active-account enforcement, role/permission/ownership isolation, appointment state rules, immutable records and certificates, authenticated PDF access, explicit credentialed CORS, hardened cookies and secrets, safe structured logging, dependency audits, and mandatory Admin TOTP MFA.

The focused `server/test/securityRegression.test.js` matrix exercises concrete cross-role attempts against the mounted Doctor, Staff, and Admin API route groups. Missing, invalid, and pre-MFA Admin sessions remain unauthenticated. Existing feature suites retain cross-Patient, assigned-Doctor, Staff least-privilege, Admin account-only, inactive-user, cancellation, completion, certificate, and input-injection coverage. Live validation scripts use disposable records, complete Admin MFA where required, and remove only their generated records.

Recovery codes remain outside the approved scope. An Admin who loses authenticator access requires controlled offline/operator recovery. Production readiness still depends on deployment-owned HTTPS termination, verified reverse-proxy trust, distributed rate limiting if the API scales beyond one process, durable security-log storage and retention/access policy, optional alerts/SIEM integration, any hosting-required cookie domain, firewall/WAF controls, backups, monitoring, and tested recovery procedures.

## End-to-end test infrastructure baseline

Milestone 24.1 establishes a Playwright Chromium suite in `e2e/` without changing product behavior. Playwright starts the React frontend and Express API, performs a backend health precheck, and exercises the real Browser -> React -> Express -> MongoDB path. The initial scope is limited to the public login smoke test and Patient authentication/session/logout smoke test; complete Patient, Doctor, Staff, and Admin journeys remain later work.

E2E execution uses a dedicated MongoDB database whose name contains `e2e`. When `E2E_MONGODB_URI` is absent, the local runner derives `arion_health_e2e` from the configured development connection without logging credentials. Disposable records use `e2e-` identifiers. Patient setup goes through the real registration API, and teardown deletes only the exact marked AuthAccount, linked Patient, and UserProfile. Broad collection deletion and production-like databases are prohibited.

The E2E runtime preserves the Milestone 23 security baseline: Helmet, request limits, targeted rate limiting, allowlist validation, role and ownership authorization, explicit CORS, HttpOnly cookies, security logging, and mandatory Admin MFA remain enabled. Admin browser helpers require a TOTP provider backed by test-only server-side enrollment data; the frontend never receives a stored MFA secret. Test-only secrets belong in ignored environment files, and only the public API origin may be passed through `VITE_API_BASE_URL`.

Local Playwright retries remain zero, CI may retry once, and failure-only screenshots/traces are ignored generated artifacts. Chromium is the only configured browser for this infrastructure milestone.

## Patient end-to-end journey baseline

Milestone 24.2 extends the Playwright Chromium suite with real Patient journeys for authentication/session restoration, approved profile updates, published-slot booking, booking conflict handling, appointment persistence/detail/cancellation, cancellation restrictions, record and Prescription viewing, certificate viewing and PDF download, empty states, cross-Patient ownership denial, and logout/protected-route redirect. The tests exercise Browser -> React -> Express -> MongoDB and retain the Milestone 23 validation, authorization, cookie, CORS, logging, request-limit, and rate-limit controls.

Each test creates independent disposable `e2e-` identities and complete linked data. Patient credentials use the production bcrypt password service and authentication repository; the original smoke test continues to exercise the public registration API. Doctor scheduling data includes active recurring and date-specific published availability. Test dates are derived from the current `Asia/Manila` clinic date, and bookable slots retain the approved 30-minute and 14-day rules.

Cleanup is relationship-scoped to the exact E2E Patient, Doctor, UserProfile, appointment, record, Prescription, certificate, and availability IDs. UI-created appointments are found through their disposable Patient/Doctor links before removal. No broad collection deletion is permitted. The Patient certificate test verifies the browser-generated PDF download filename and `%PDF` file signature; lower-level PDF tests continue to validate detailed document content.

Doctor, Staff, and Admin coverage was subsequently completed in Milestones 24.3–24.5.

## Doctor end-to-end journey baseline

Milestone 24.3 extends the Playwright Chromium suite with real Doctor journeys covering authentication/session restoration, dashboard and schedule projections, recurring and published availability, blocked times, consultation context, MedicalRecord and Prescription persistence, immutable history, certificate issuance and PDF output, Doctor-owned consultation completion, deterministic scheduling/clinical failures, cross-Doctor ownership denial, empty states, and logout/protected-route behavior.

The suite exercises Browser -> React -> Express -> MongoDB without route interception or frontend mocks. Doctor credentials are created through the existing production hashing boundary, test dates are derived from `Asia/Manila`, and database assertions confirm that successful and rejected UI/service actions preserve the expected state. Each test owns unique `e2e-` identities and removes only records linked to those identities.

Staff and Admin coverage was subsequently completed in Milestones 24.4 and 24.5.

## Staff end-to-end journey baseline

Milestone 24.4 extends the Playwright Chromium suite with real Staff journeys for authentication/session restoration, live dashboard and calendar projections, appointment confirmation, Patient search, no-account walk-in registration, duplicate detection, same-day walk-in appointment creation, check-in, queue persistence and ordering, urgent priority updates, the single Senior/PWD tier, no-show transitions, Doctor-owned consultation completion removal, limited record summaries, clinical-action denial, empty states, and logout/protected-route behavior.

The suite exercises Browser -> React -> Express -> MongoDB without route interception or frontend mocks. Staff credentials use complete linked UserProfile, AuthAccount, and Staff records with the production password hashing service. Walk-in Patients retain a null `user_profile_id`, same-day appointments record the authenticated Staff identity in `created_by`, and non-current clinic dates are rejected by the backend. Queue tests use the current `Asia/Manila` clinic date, verify server-derived priority tiers and check-in ordering, and confirm that Senior plus PWD does not receive an extra tier.

Staff record access is verified against the approved limited projection: Patient name, encounter time, and attending Doctor remain visible, while diagnosis, detailed notes, Prescriptions, certificate content, MedicalRecord creation, certificate issuance, and consultation completion remain unavailable. Completion is performed only through an authenticated assigned-Doctor boundary and removes the appointment from the active Staff queue.

Every Staff test creates independent `e2e-` identities and removes only records linked to those exact Staff, Patient, Doctor, appointment, record, Prescription, certificate, and availability identities. Admin browser coverage was subsequently completed in Milestone 24.5.

## Admin and MFA end-to-end journey baseline

Milestone 24.5 extends the Playwright Chromium suite with real Admin journeys for first-time TOTP enrollment, enrolled login, password-only denial, invalid and expired verification, consumed-challenge replay rejection, MFA rate limiting, authenticated dashboard/session/logout behavior, Doctor and Staff provisioning and lifecycle management, Patient portal lifecycle management, no-account walk-ins, and Admin clinical restrictions.

Disposable Admin UserProfiles and AuthAccounts use the production password hashing, MFA encryption, challenge-cookie, TOTP verification, and full-session boundaries. Test-only TOTP secrets exist only in helper memory or encrypted E2E records. Enrollment tests disable trace and screenshot capture because the approved UI displays the one-time setup key. The suite asserts that browser local and session storage remain empty, pre-MFA challenges cannot access Admin APIs or pages, successful challenges are consumed, expired challenges fail, and repeated invalid verification is safely rate limited.

Doctor and Staff lifecycle journeys verify server-forced roles, hashed credentials, approved profile updates, inactive login denial, reactivation, stable role-profile IDs, and rejection of protected-field updates. Patient journeys verify real search, status filtering, pagination, stable Patient identity, inactive login denial, reactivation, preserved MedicalRecord history, and no lifecycle action for a walk-in whose `user_profile_id` is null. Admin remains unable to create MedicalRecords, issue certificates, complete consultations, or open Doctor clinical pages.

Each test owns unique `e2e-` identities. Admin-provisioned accounts are added to the scenario by exact email and role-profile relationship before teardown, and cleanup never deletes broadly or touches permanent Admin accounts. The cross-role security matrix was completed in Milestone 24.6.

Structured security-event payloads remain covered by the backend security-logging regression suite because the Playwright-managed API process does not expose a safe in-process log collector. The E2E journeys exercise the corresponding login, MFA, provisioning, and lifecycle events without capturing console output that could contain operational metadata.

## Cross-role security end-to-end baseline

Milestone 24.6 completes the browser security matrix against the real React -> Express -> MongoDB path. Disposable Patient, Doctor, Staff, and MFA-authenticated Admin sessions prove unauthenticated and inactive-session denial, frontend wrong-role navigation, Patient and Doctor resource ownership, Staff clinical-data minimization, pre-MFA Admin isolation, and Admin's account-management-only scope.

Browser-context API attempts cover protected identity and lifecycle fields, role escalation, creator spoofing, certificate-number spoofing, malformed identifiers, wrong scalar types, operator-shaped queries, and non-empty bodies on server-owned state transitions. Rejected requests must return a safe 4xx response, preserve MongoDB state, expose no credentials or protected signature path, and cause no page error or unexpected 500 response. Patient and Admin sessions continue to use HttpOnly cookies with no token material in local or session storage.

The intentional MFA rate-limit exhaustion remains the final E2E test so it cannot contaminate later Admin journeys. Exact scenario cleanup removes only generated E2E relationships. CORS allowlist behavior, structured security-event contents, detailed cookie attributes, and exhaustive limiter behavior remain deterministic backend-test responsibilities; the browser suite exercises their surrounding authenticated flows without weakening them.

## Milestone 24 final regression and deployment readiness

Milestones 24.1 through 24.7 are complete. The final Milestone 24.7 pass ran the 48-test Chromium suite three consecutive times with zero retries and no failures. A headed-browser smoke also covered Patient login and booking, Doctor schedule and clinical detail, Staff queue and Patient search, and Admin MFA plus account management. Every run used the real React -> Express -> MongoDB path.

All 12 dedicated E2E database collections returned to zero records after each full run. No disposable AuthAccounts, UserProfiles, Patients, Doctors, Staff profiles, Appointments, scheduling records, MedicalRecords, Prescriptions, or MedicalCertificates remained. No orphan identities or clinical children, E2E listeners, browser processes, reports, screenshots, traces, videos, PDF downloads, or temporary MFA artifacts remained after validation. The Admin enrollment test continues to disable screenshots and traces because it displays a one-time setup secret.

The Milestone 25.2 verification suite passes 106 frontend tests, 237 backend tests, and 48 browser E2E tests. The production frontend build succeeds, and both dependency audits report zero vulnerabilities. Production source and bundle scans contain no backend credentials, connection strings, private keys, JWT literals, E2E credentials, or Playwright/E2E imports. Legacy mock modules remain deterministic unit fixtures and are excluded from the production module graph.

Production configuration requires `MONGODB_URI`, a unique `AUTH_SECRET`, a base64 32-byte `MFA_ENCRYPTION_KEY`, explicit `CORS_ORIGIN` values, the public frontend `VITE_API_BASE_URL`, `CLINIC_TIME_ZONE`, and a real `CLINIC_LOCATION`. `CLINIC_OPEN_TIME` and `CLINIC_CLOSE_TIME` remain optional until approved clinic hours are configured. Secrets belong in the deployment secret store and must never use a frontend `VITE_` variable.

Milestone 25 subsequently completed the Vercel Preview and restricted Production deployment work described below. The final environment decisions, verified controls, free-tier limitations, and operational requirements are summarized in `PROJECT_HANDOFF.md` and `OPERATIONS_RUNBOOK.md`.

## Milestone 25.2 Vercel deployment preparation

The repository is prepared for one Vercel Services project. `vercel.json` defines the root Vite service and the `server/` Express service, routes `/api/*` to Express before the frontend catch-all, and applies the Vite `index.html` fallback only inside the frontend service. Direct React Router navigation therefore remains frontend-owned while API paths retain their existing `/api` prefix. Static frontend responses receive `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and `X-Frame-Options: DENY`; backend responses continue to use Helmet.

`server/src/vercel.js` is the listener-free deployment handler. It validates runtime configuration, awaits the cached MongoDB connection, constructs the existing Express application once per warm instance, and retries initialization after a failed connection. `server/src/server.js` remains the local long-running entry with `listen()` and shutdown handling. Mongoose connection state and the in-flight connection promise are cached globally for serverless reuse and cleared after connection failure or deliberate disconnect.

Production and preview frontend requests use the same public origin as the API. Because every frontend repository path already begins with `/api`, the production `VITE_API_BASE_URL` is intentionally empty; `/api` must not be used as the base. Local development may explicitly use `http://127.0.0.1:5000`. The Vite and Express packages are pinned to Node.js `24.x`.

Production trusts exactly one Vercel proxy hop so Express can resolve the sanitized forwarded client IP and HTTPS protocol. This setting is disabled outside production. Preview verified it against Vercel ingress; the final Production deployment must repeat the check. The `arion_auth` and MFA challenge cookies remain host-only, HttpOnly, SameSite=Lax, Path `/`, and Secure in production. Same-origin routing requires no `Domain` override or SameSite=None relaxation.

Vercel production and preview environments must remain separate. Production `CORS_ORIGIN` is the exact production site origin. Preview must use a stable trusted preview alias or an explicitly configured exact preview origin; arbitrary `*.vercel.app` origins are not trusted. The frontend service receives only public `VITE_API_BASE_URL`. The backend service receives `MONGODB_URI`, `AUTH_SECRET`, `MFA_ENCRYPTION_KEY`, `NODE_ENV`, `CORS_ORIGIN`, clinic configuration, and optional rate-limit overrides. MongoDB and cryptographic values are secrets; CORS, clinic display/schedule values, runtime mode, and limiter thresholds are non-secret configuration.

The one-time Admin bootstrap remains a manual operator action using `server/scripts/createAdmin.js` from a controlled environment. It is never part of the Vercel build, function initialization, or public registration flow.

At the end of Milestone 25.2, remaining blockers included Atlas Production provisioning and tested backups, Production secret creation/storage, platform-wide rate limiting, real clinic location and timezone confirmation, protected Doctor signature object storage and actual image rendering, confirmation that the target Vercel account can use Services, and live HTTPS/cookie/CORS/proxy validation. `Doctor.signature_path` remains metadata; no application code assumes local persistent file storage and no fake signature is rendered. The following Milestone 25.3 section records which of these items changed.

## Milestone 25.3 controlled Preview status

The Vercel project `sumnio/arion-health-portal` is linked and the account recognizes the Vite frontend and Express backend Services in `vercel.json`. Vercel CLI `60.1.3` was used through an exact `npx` invocation rather than retained as an application dependency. GitHub automatic deployment is not connected because Vercel could not access this private repository.

The free Atlas resource `arion-health-preview` is isolated to Vercel's Preview environment and uses the explicit application database `arion_health_preview`. Preview has separate generated authentication and MFA secrets, the integration-managed MongoDB URI, exact-origin CORS for the reserved Preview alias, production runtime cookie semantics, `Asia/Manila` clinic time, non-sensitive Preview clinic labels, and an empty same-origin frontend API base. Production environment configuration remains empty. Secrets are held only by Vercel/integration configuration and are not committed or documented.

The native Atlas integration requires `0.0.0.0/0` network access for Vercel's dynamic outbound addresses and generates an integration credential with write access across non-system databases on the isolated resource. This exception is approved only for Preview and is compensated by TLS, generated credentials, resource isolation, environment scoping, and the dedicated application database. The free Atlas tier does not provide managed backups; Production backup and recovery require a separate approved configuration.

The process-local rate-limit deployment blocker is addressed in code by a shared MongoDB store used in production-mode local and serverless entrypoints. It preserves the existing endpoint policies, shares atomic counters across instances, separates limiter namespaces, expires counters with a TTL index, and fails closed when unavailable. Live Preview testing confirmed the shared login counter by returning ten expected authentication failures and `429 RATE_LIMITED` on the eleventh request. The live test used one client, while the store implementation and focused tests cover shared atomic behavior.

The retained application is a Vercel **Preview** deployment at the protected stable alias `https://arion-health-preview.vercel.app`; its deployment ID is `dpl_HoNwvbX144mjwZtyRC333jE8aPQ8`. A user-approved non-operational bootstrap was temporarily created to unlock first Preview creation. Vercel assigned it a Production alias despite `--skip-domain`; the alias was removed immediately. The bootstrap had no Production environment variables, secrets, database connection, accounts, or data and was deleted after Preview verification. No Production deployment or alias remains and Production environment configuration is empty.

Deployment Protection requires authenticated Preview access. Live verification passed for health, frontend and React Router deep-link routing, same-origin `/api` routing, exact-origin credentialed CORS and untrusted-origin denial, Helmet/security headers, secure host-only HttpOnly authentication cookies, session restoration, logout, real Admin TOTP MFA, all four role dashboards, proxy-resolved request IPs, structured security events, MongoDB connectivity, and shared rate limiting. Runtime logs showed normal warm reuse with a small number of connection starts and no recurring MongoDB errors. Disposable identities and limiter counters were removed by exact generated identifiers and verified absent; no permanent Preview Admin was created.

Milestone 25.3 is complete. Final regression passes 106 frontend tests, 241 backend tests, 48 Playwright E2E journeys, the production build, and both dependency audits with zero reported vulnerabilities. Remaining Production blockers are protected Doctor signature object storage and image rendering, durable security-log storage/retention/access, a separately approved Production Atlas resource with tested backup and recovery, Production secrets and real clinic configuration, monitoring and alerts, and the final controlled Production deployment.

## Milestone 25.4 restricted Production status

Milestone 25.4 regression passes 107 frontend tests, 242 backend tests, all 48 Playwright E2E journeys, the Production build, and both audits with zero vulnerabilities.

The free-tier Production environment is deployed at `https://arion-health-portal.vercel.app` with an isolated `arion-health-production` Atlas resource and `arion_health_production` database. It is **DEPLOYED + RESTRICTED** for school/demo use and synthetic testing only; real patient and clinical operations are prohibited. Preview remains isolated and healthy.

Atlas Free has no managed backups or point-in-time recovery. Vercel Hobby has one-hour runtime log retention and no Log Drain. Disaster recovery, durable security-log retention, and production alerting remain deferred free-tier limitations. They must be resolved before real clinical use.

Production uses the approved clinic name `Arion Medical Center`, location `20 Indonesia Street, corner France Street, Better Living Subdivision, Paranaque City, 1700 Metro Manila`, and timezone `Asia/Manila`; operating hours are intentionally unset. Runtime validation requires the explicit Production database and clinic values, and the Admin bootstrap connects to the configured database.

Doctor signature storage and authorized rendering remain unresolved. Production certificate issuance is disabled in the backend and Doctor UI and fails closed for direct API calls. Local and Preview behavior remains available for testing. Health, routing, exact-origin CORS, HTTPS/security headers, shared MongoDB rate limiting, and structured security events were validated live.

The permanent Production Admin was bootstrapped once through the approved `createAdmin.js` flow into `arion_health_production`. Temporary hidden Vercel `ADMIN_*` inputs and ignored local bootstrap values were removed immediately, the normal build configuration was restored, a normal Production deployment replaced the bootstrap build, and the inactive bootstrap deployment was deleted. First-time TOTP enrollment, subsequent MFA login, Admin dashboard access, refresh/session restoration, logout, and post-logout protected-route denial were verified. No browser token was stored; localStorage and sessionStorage remained empty, and the HttpOnly cookie was not visible to JavaScript. Production-mode regression verifies host-only, Secure, SameSite=Lax, Path `/` cookie attributes.

## Milestone 25.5 live Production security validation

The active restricted Production deployment passed a dedicated live security validation. The frontend and health route returned 200; HTTP redirected to HTTPS; HSTS, CSP, nosniff, frame, referrer, cross-origin, and related Helmet protections remained present; and `X-Powered-By` remained absent. Production-origin credentialed CORS succeeded, while an untrusted origin and the Preview origin were denied with 403. The deployed frontend made same-origin `/api` requests without a duplicate API prefix, browser token storage, JavaScript-visible cookies, or page errors.

The permanent Admin completed two full password-plus-TOTP logins. A password-only MFA challenge could not access Admin routes, the authenticated session survived reload, logout cleared access across refresh and direct navigation, and the next login required MFA again. The browser was left logged out. Exact cookie flags and lifetime remain covered by Production-mode HTTP regression without recording cookie values.

The Production MongoDB limiter returned 429 after the approved ten failed-login allowance and supplied retry/rate-limit headers. The nonexistent validation identity created no account, and the indexed TTL window for the temporary counter elapsed before completion. A client-supplied reserved forwarded IP was not accepted by Vercel as the resolved client IP. Production still trusts exactly one proxy hop; shared atomic counter behavior and fail-closed store failure remain covered without disrupting the live database.

Runtime logs contained expected structured authentication, logout, and limiter events with resolved client metadata, no error-level entries, and none of the scanned credential, cookie, connection-string, MFA, or clinical markers. Production and protected Preview remain separate Ready deployments and Preview health remains 200. Their environment-variable names and scopes remain separated; secret values were not downloaded. The existing Production database/clinic configuration remains `arion_health_production`, `Arion Medical Center`, the approved Parañaque City location, `Asia/Manila`, and unset operating hours.

Production certificate issuance remains disabled in the backend and Doctor UI. The live Admin dashboard showed zero Doctor, Staff, and Patient records, and this milestone created no disposable Production identity or clinical record. The Production role APIs denied unauthenticated requests. Inactive-account, wrong-role, ownership, protected-field, and direct certificate-issuance cases were reconfirmed through the isolated real-stack E2E and backend suites so Production would not retain account history that the approved API intentionally cannot hard-delete.

Milestone 25.5 passes 107 frontend tests, 242 backend tests, 48 Playwright journeys, the Production build, both zero-vulnerability dependency audits, `git diff --check`, and source/bundle secret scans. Temporary browser-test artifacts and listeners were removed. Production remains **DEPLOYED + RESTRICTED** and is suitable only for school/demo use with synthetic testing. Atlas Free backup/PITR limits, Vercel Hobby log-retention/Log-Drain limits, deferred monitoring and alerts, unresolved protected Doctor signature storage/rendering, disabled certificate issuance, and the ban on real clinical data remain in force.

## Milestone 25.6 free-tier operational hardening

Operations for the restricted Production environment follow `OPERATIONS_RUNBOOK.md`. Operators use Vercel's available Hobby deployment/runtime views and notifications, Atlas Free Connections, Logical Size, Network, and Opcounter metrics/alerts, the `/api/health` endpoint, and the documented incident checklist. Plan-limited advanced observability, longer retention, Log Drains, SIEM, managed backup/PITR, and paid alerting remain deferred and must not be described as implemented.

The only backup mechanism documented for this demo environment is an approved manual `mongodump` from a trusted operator machine to an encrypted destination. The optional helper is guarded, environment-driven, exact-database scoped, and unscheduled. Production restore testing is prohibited; a backup may be restored only to a disposable local/test database and removed after verification. Vercel application rollback does not roll back Atlas data.

Secure recovery custody outside Vercel is required for `AUTH_SECRET`, `MFA_ENCRYPTION_KEY`, Production Atlas credentials, and permanent Admin credentials. Actual values must never enter the repository or logs. Production remains synthetic/demo-only with certificate issuance disabled and unresolved Doctor signature storage/rendering.

Milestone 25.6 validation confirms Ready, separate Production and Preview deployments; Production health/home/login responses of 200; protected Preview ingress; the required Production environment names without temporary `ADMIN_*`; 107 frontend, 242 backend, and 48 E2E passes; a successful Production build; clean dependency audits; and clean whitespace/secret/artifact checks. The current Hobby log window contained only the health request and a safe database-connection message; older security-event visibility is supported by the Milestone 25.5 live review and current deterministic backend logging tests, not by durable Production retention.

## Milestone 25.7 live Production E2E status

The active Production deployment passed a dedicated live smoke using only disposable `prod-smoke-*` identities and non-clinical appointment context. Patient, Doctor, and Staff login, role pages, reload/session restoration, logout, representative lifecycle denial/reactivation, wrong-role guards, and Patient appointment ownership were verified against the deployed frontend, API, and isolated Production database. The permanent Admin completed password-plus-TOTP login, loaded all approved account pages, survived refresh, logged out, and was denied protected navigation afterward without changing credentials or MFA configuration.

Production certificate issuance remained unavailable in the Doctor interface and rejected by the direct API with no certificate creation. Live CORS, HTTPS/security headers, shared login limiting, redacted structured logs, session invalidation, and the absence of browser-stored tokens remained consistent with the approved security model. Production and Preview were reconfirmed as separate Ready deployments using `arion_health_production` and `arion_health_preview`, with the local E2E database separately isolated.

Cleanup deleted every disposable Production AuthAccount, UserProfile, Patient, Doctor, Staff, Appointment, availability/block, related record, certificate, and validation limiter by exact generated identity and verified zero remnants or orphans. The permanent active MFA-enrolled Admin remains. No real diagnosis, Prescription, MedicalRecord, or certificate was created.

Milestone 25.7 completes with 107 frontend tests, 242 backend tests, 48 E2E journeys, a successful Production build, and zero dependency-audit vulnerabilities. Production remains **DEPLOYED + RESTRICTED**; the free-tier recovery/logging/monitoring limits, disabled certificate issuance, unresolved protected signature storage/rendering, and prohibition on real clinical data remain unchanged.

## Milestone 25.8 final documentation and handoff

Milestones 13–23, 24.1–24.7, and 25.1–25.8 are complete. The software MVP and its controlled deployment phase are complete. Production remains **DEPLOYED + RESTRICTED** at `https://arion-health-portal.vercel.app`, Preview remains protected and isolated at `https://arion-health-preview.vercel.app`, and Production `/api/health` returns 200.

`PROJECT_HANDOFF.md` is the concise continuation document for system status, architecture, role boundaries, authentication/security, the 107 frontend / 242 backend / 48 E2E baseline, environment-variable names, deployment and rollback, backup limitations, certificate status, requirements before real clinical use, post-MVP workflow, backlog, and final classification. `OPERATIONS_RUNBOOK.md` remains the detailed operational procedure.

The current Production environment is safe only for school/demo presentation and synthetic testing. It is not authorized for real patient or clinical data, live clinic operations, Production certificate issuance, or claims of managed recovery or durable audit logging. New work is post-MVP feature development and requires a separate approved scope.
