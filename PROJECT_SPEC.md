# Arion Health Portal

## Backend transition status

The selected backend direction is Node.js, Express, and MongoDB through Mongoose. The backend now includes its foundation, approved models, authentication and authorization foundations, Patient profile and appointment APIs, Doctor scheduling/bookability APIs, clinical record/certificate/Doctor completion APIs, Staff operations APIs, and Admin account-management APIs.

Frontend authentication now uses the backend API through a centralized credentialed HTTP client. Login, Patient registration, logout, session restoration, and protected route guards are real. Patient, Doctor, and Staff portal feature data use live APIs. Admin account-management frontend data remains in mock repositories until its migration milestone.

## Clinical API status

The assigned active Doctor may create one MedicalRecord for a confirmed Appointment through `POST /api/doctor/appointments/:appointmentId/medical-record`. Patient and Doctor IDs are resolved from the Appointment and authenticated Doctor; clients cannot choose them. Zero or more validated Prescriptions are created with the MedicalRecord. MongoDB transactions are used when supported, with explicit cleanup fallback for development deployments that do not support transactions.

Doctors may read only records from their own consultations through `GET /api/doctor/patients/:patientId/records` and `GET /api/doctor/records/:recordId`. Patients may read only their own records through `GET /api/patient/records` and `GET /api/patient/records/:recordId`. No MedicalRecord or Prescription edit/delete API exists in the MVP.

`POST /api/doctor/records/:recordId/certificates` directly issues a certificate, matching the approved UI flow. The server generates its unique human-readable certificate number and links the authenticated Doctor, Patient, and MedicalRecord. Patients see only their own issued certificates; Doctors see only certificates they issued. Responses resolve Doctor display name, specialty, license number, PTR number, and signature availability from the Doctor profile, and include shared clinic display configuration without exposing the protected signature path. Issued certificates have no edit/delete API.

`PATCH /api/doctor/appointments/:appointmentId/complete` is restricted to the assigned Doctor. It requires a confirmed, checked-in Appointment and its saved MedicalRecord. Staff, Patient, and Admin roles cannot complete consultations or call clinical creation endpoints.

## Staff operations API status

Staff can search basic Patient information with `GET /api/staff/patients?search=`, register guest walk-ins with `POST /api/staff/patients/walk-in`, and create same-day walk-in Appointments with `POST /api/staff/patients/:patientId/walk-in-appointments`. Walk-in registration creates only a Patient with `user_profile_id = null`; it creates no UserProfile or AuthAccount. Clear matches by contact number or exact name plus DOB are rejected so Staff can reuse the existing Patient identity. Name alone is never treated as a definitive duplicate.

Staff-created walk-in Appointments are immediately `confirmed`, matching the approved Staff UI flow. They use the existing Appointment entity, preserve `Patient.id`, store the authenticated Staff UserProfile in `created_by`, and remain subject to same-Doctor slot uniqueness. Scheduled pending appointments continue to use `PATCH /api/staff/appointments/:appointmentId/confirm`.

`PATCH /api/staff/appointments/:appointmentId/check-in` sets `check_in_at` from server time for an unchecked confirmed Appointment. `GET /api/staff/queue` returns only confirmed, checked-in Appointments on the current clinic day. Queue order is Urgent, then the shared Senior/PWD tier, then Normal; same-tier ordering uses `check_in_at`. Senior status is derived from DOB and is not stored. `PATCH /api/staff/appointments/:appointmentId/priority` accepts only `normal` or `urgent`.

`PATCH /api/staff/appointments/:appointmentId/no-show` preserves an eligible due, unchecked pending/confirmed Appointment while changing its status to `no_show`, which removes it from the queue. Doctor completion likewise removes an Appointment from Staff queue results. No Staff completion endpoint exists.

`GET /api/staff/patients/:patientId/record-summary` returns only Patient name, encounter time, attending Doctor, and diagnosis summary. It excludes notes, prescriptions, and certificate content.

The live Staff frontend uses `GET /api/staff/appointments?date=YYYY-MM-DD` for operational calendar/day data, `GET /api/staff/doctors` for the active Doctor directory, and `GET /api/staff/patients/:patientId` for basic Patient context. These endpoints expose only the fields needed by approved Staff workflows. `PATCH /api/staff/appointments/:appointmentId/cancel` preserves the Appointment while allowing Staff to cancel only an unchecked pending or confirmed Appointment.

## Admin account API status

Admin-only `/api/admin/doctors` and `/api/admin/staff` APIs provision linked AuthAccount, UserProfile, and Doctor/Staff records. Roles are assigned server-side, passwords are stored only as bcrypt hashes in AuthAccount, and responses never expose hashes. Doctor and Staff list/detail/update routes return only approved non-clinical administrative fields. Provisioning uses MongoDB transactions when available with rollback cleanup when transactions are unavailable.

Doctor, Staff, and linked Patient portal lifecycle routes explicitly deactivate or reactivate the related UserProfile using only `active` and `inactive`. They preserve the role profile ID, UserProfile ID, AuthAccount, Appointments, created-by references, and clinical history. There are no hard-delete endpoints. Existing active-account authorization immediately denies protected access after deactivation.

`GET /api/admin/patients` and `GET /api/admin/patients/:patientId` return basic Patient/account information only and support name/contact search plus `active`, `inactive`, and `no_account` filters. A Patient with `user_profile_id = null` has no portal lifecycle action; Admin cannot create an account for that walk-in through this milestone. Admin remains unable to read or edit clinical data through account routes.

Current transition:

```text
React -> service layer -> mock repositories
                         (current feature data)

React -> service layer -> Express API -> MongoDB
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

Every Patient endpoint requires a valid authenticated session, an active UserProfile with role `patient`, and a Patient linked through `Patient.user_profile_id`. The API never accepts `patient_id` for self-service operations. Profile lookup, appointment list/detail, creation, and cancellation are scoped to that linked Patient. Appointment ownership failures use the same not-found response as missing appointments to avoid exposing another Patient's data.

Patient profile updates support the approved contact and emergency-contact fields, PWD status, and the existing profile workflow's `dob` and `sex` fields. Updating `full_name` or `contact_number` also keeps the linked UserProfile's shared display/contact values synchronized. Identifiers, account status, role, allergies, and clinical data cannot be changed through this endpoint.

Patient appointment creation accepts only `doctor_id`, `appointment_at`, canonical `visit_type`, and the schema-required free-text `reason`. The server derives the Patient, sets `created_by` to the authenticated Patient UserProfile ID, sets `status = pending`, `priority = normal`, and `check_in_at = null`, enforces future 30-minute slot boundaries and the approved 14-day Patient booking window, and maps the active same-Doctor/time unique-index collision to HTTP 409. Clients cannot choose or override the creator identity.

Patients may cancel only their own `pending` or `confirmed` appointments. Cancellation changes the status to `cancelled` and preserves the document. Completed, cancelled, and no-show appointments reject cancellation. No cancellation cutoff has been invented.

The Staff lifecycle action `PATCH /api/staff/appointments/:appointmentId/confirm` requires an active Staff account and permits only `pending -> confirmed`. The backend also implements the approved check-in, queue, no-show, priority, and walk-in operations. Consultation completion remains Doctor-owned.

Server-side booking requires date-specific DoctorPublishedAvailability, removes DoctorBlockedTime overlaps and active occupied slots, and applies configured clinic hours when present. The existing MongoDB partial unique index remains the final concurrency guard against same-Doctor active slot collisions. Patient booking, Doctor scheduling, and Staff operations now use live APIs; the Admin frontend migration remains later work.

## Doctor scheduling and bookability backend API

Authenticated Doctors manage only their own schedule through:

- `GET`, `POST /api/doctor/availability`
- `PATCH`, `DELETE /api/doctor/availability/:id`
- `GET`, `POST /api/doctor/published-availability`
- `DELETE /api/doctor/published-availability/:id`
- `GET`, `POST /api/doctor/blocked-times`
- `DELETE /api/doctor/blocked-times/:id`

The API resolves Doctor ownership from the authenticated UserProfile and never accepts `doctor_id` for an own-schedule mutation. Multiple non-overlapping recurring ranges on one weekday are supported. Date-specific publication must be today through 30 days ahead, align to 30-minute boundaries, remain within one active recurring range, and not overlap another published range for that Doctor/date.

Patients retrieve bookable times through `GET /api/patient/doctors/:doctorId/available-slots?date=YYYY-MM-DD`. Recurring availability alone never produces Patient slots. Slot generation starts from explicitly published ranges, then removes past times, DoctorBlockedTime overlaps, and appointments in the blocking statuses `pending`, `confirmed`, and `completed`. The Patient date must be within the 14-day horizon. `POST /api/patient/appointments` applies the same calculation before persistence, while the MongoDB partial unique index handles concurrent same-Doctor slot attempts.

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

The backend authentication endpoints are `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, and `GET /api/auth/me`. Registration is Patient-only, shared login resolves the trusted linked UserProfile, inactive accounts receive the same generic credentials error as other login failures, logout clears the cookie, and `/api/auth/me` returns only safe profile fields.

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

The frontend never reads or stores the JWT in localStorage or sessionStorage. Password recovery, email verification, and MFA remain later work. Patient, Doctor, and Staff feature repositories are live; Admin remains mocked.

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
- Manage own recurring availability and blocked time through the existing Doctor schedule workflow
- View patient information
- Create medical records
- Mark an assigned eligible consultation completed after its MedicalRecord has been saved
- Issue medical certificates

### Staff
- View the Staff Dashboard
- View and manage the clinic calendar and appointment operations
- Search existing patients and register walk-in patients
- Create same-day walk-in appointments
- Check in patients and manage the queue

## Staff permissions

Staff access follows least-privilege principles and is limited to clinic operations plus the approved limited medical-record summary.

### Operational access

Staff may:

- view the Staff Dashboard;
- view and manage the clinic calendar;
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
- Doctors manage their own availability and blocked time under the scheduling rules below. Availability management remains associated with the approved Doctor schedule workflow; no separate route is approved.

## Medical certificate rules

MedicalCertificate contains `id`, unique `medical_certificate_number`, `patient_id`, `doctor_id`, nullable `medical_record_id`, `date_issued`, `purpose`, `diagnosis_summary`, nullable `valid_until`, `status`, `created_at`, and `updated_at`. Status is limited to `draft` and `issued`. The exact certificate-number format is not yet finalized.

Certificate display/generation must show the linked Doctor's license number, PTR number, and signature image, plus the clinic location. License and PTR values come from `Doctor.license_number` and `Doctor.ptr_number`; the signature image comes through `Doctor.signature_path`. Do not duplicate these values in MedicalCertificate for the current MVP.

`Doctor.signature_path` stores only a protected path/reference. The raw image binary is not stored in Doctor. The image must be stored in protected object/file storage and must not be publicly exposed outside the intended certificate flow.

Clinic location is simple application/global configuration used only for certificate display/generation. Do not create a clinic-management system or add clinic location to MedicalCertificate.

Draft certificates may exist only during the approved Doctor creation flow at `/doctor/records/:id/certificate/new`. Once issued, a certificate is read-only: the MVP provides no Edit, Update, Delete, Reissue, or Modify action. Patients and Staff cannot edit certificates, Admin cannot edit certificate clinical content, and Doctors issue certificates only through the approved flow.

When `medical_record_id` is present, it links to the related MedicalRecord. Patient and Doctor relationships must always be preserved.

QR verification, public certificate verification, external sharing, advanced digital-signature infrastructure, payment integration, and real PDF generation remain unimplemented future scope.

## Doctor scheduling

DoctorAvailability stores `id`, `doctor_id`, `day_of_week`, `start_time`, `end_time`, and `is_active` for recurring weekly hours. A doctor may publish multiple availability ranges on the same day. For example, 9:00 AM-12:00 PM and 1:00 PM-5:00 PM leaves a recurring lunch break between the ranges. This is the preferred representation for a regular lunch break or other recurring break; it does not require DoctorBlockedTime.

DoctorPublishedAvailability stores the specific dates and time ranges the Doctor has actually confirmed for patient booking. It is distinct from the recurring DoctorAvailability template. Its Mongoose fields are `id`, `doctor_id`, `availability_date`, `start_time`, `end_time`, `created_at`, and `updated_at`.

DoctorBlockedTime stores `id`, `doctor_id`, `start_at`, `end_at`, and `reason` for one-time or temporary whole-day and partial-day exceptions. Examples include leave, a meeting, a conference, clinic closure, an emergency absence, a personal break, a temporary lunch-time change, or another one-time unavailable period.

### Scheduling and publication rules

- Appointment slots are fixed at 30 minutes.
- Doctors manage their own recurring availability and blocked time within the existing `/doctor/schedule` workflow; no separate availability route is added.
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

These are the only approved fixed MVP visit types. Appointment stores them in `visit_type` using canonical values `general_consultation`, `follow_up`, and `check_up`. Do not create a Service or Department table or conflate visit type with the free-text reason for visit.

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
- Only eligible Appointments may be checked in. `pending` and `confirmed` may be eligible; `cancelled`, `completed`, and `no_show` are not eligible for normal check-in.
- Check-in sets `check_in_at` and adds the patient to the waiting queue. A non-null `check_in_at` prevents duplicate check-in and must not be overwritten by a repeated normal check-in.
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

The selected backend direction is an Express + Node.js API backed by MongoDB/Mongoose. The React frontend must continue using its service/API abstraction so replacing the current mock repositories does not require rewriting UI components.

Authentication, active-account checks, role authorization, ownership checks, least-privilege access, history preservation, and protected signature access are provider-independent requirements. Supabase RLS may enforce database access when Supabase is selected; an Express implementation must enforce equivalent checks in the API and persistence layers.

The Mongoose models map the approved entities to separate collections and ObjectId references. Backend feature APIs and frontend authentication are active. Patient dashboard, profile, booking, appointment, record, and certificate pages use the authenticated Patient API. Doctor dashboard, schedule/availability, consultation detail/history, medical-record/prescription creation, certificate issuance/view, and completion use the authenticated Doctor API. `GET /api/doctor/appointments` supplies the minimal ownership-scoped assigned-appointment projection required by the existing Doctor routes, with optional date and Patient filters. Staff dashboard, calendar, queue, Patient search, walk-in registration/appointment creation, and approved operational actions use authenticated Staff APIs. Admin frontend migration remains later work.
