# Arion Health Portal - Revised Database Schema

This is the approved logical schema for the Arion Health Portal MVP. Relational type examples remain useful as a reference, while the selected MEN backend implements the same entities with Mongoose documents, generated `_id` ObjectIds, ObjectId references, and `created_at`/`updated_at` timestamps. The implementation must preserve the approved data, relationships, constraints, and access rules.

Main revisions:
- UUID primary keys
- A dedicated authentication system handles credentials and sessions
- `Appointment` replaces `Schedule`
- `MedicalRecord` replaces generic `Records`
- Doctor availability is normalized
- Prescriptions use their own table
- Appointment date/time uses timestamps
- Queue/check-in support is included
- Created/updated timestamps are included

### MongoDB/Mongoose mapping

- Each model uses MongoDB `_id` as its `id`; relationship fields use ObjectId references.
- Mongoose timestamps map to `created_at` and `updated_at`.
- `Doctor.user_profile_id` and `Staff.user_profile_id` are required unique links. `Patient.user_profile_id` is a nullable unique link so multiple walk-ins can remain unlinked.
- No hard-delete cascade middleware is used. Account deactivation preserves every historical reference.

---

# 1. Authentication and User Profiles

Authentication credentials are owned by the backend AuthAccount model. Email and `password_hash` are authentication data and are not fields in the approved UserProfile structure. Password recovery/reset, email verification, and MFA remain future work.

Passwords, including password hashes, must not be stored in UserProfile, Patient, Doctor, or Staff. UserProfile stores application identity, role, common contact information, and account status, not authentication credentials. Doctor and Staff must not contain username-based authentication fields.

Portal accounts have one AuthAccount linked one-to-one with one UserProfile. Patient records are independent and only link to a UserProfile when the patient has a portal account. Doctor and Staff link through their required unique `user_profile_id` references.

Admin is represented by `UserProfile.role = admin`; there is no separate Admin entity.

### Authentication and provisioning boundary

- `/login` is shared by Patient, Doctor, Staff, and Admin. Real authentication uses credentials managed by the selected authentication system and never requires manual role selection.
- `/register` is Patient self-registration only. Public registration must force the trusted application role to `patient`; it must not accept a client-selected role or permit self-registration as Doctor, Staff, or Admin.
- Admin provisions Doctor and Staff accounts. The Admin account is provisioned separately. Patients cannot promote their own role.
- AuthAccount links to UserProfile through required unique `user_profile_id`. The trusted UserProfile supplies application role and status.
- The current mock role selector and “Exit mock preview” controls are temporary and must be removed during real authentication implementation.

## AuthAccount

| Field | Type | Notes |
|---|---|---|
| id | identifier, PK | MongoDB `_id` |
| user_profile_id | identifier, FK, unique | Required reference to `UserProfile.id`; one credential account per profile |
| email | text, unique | Required; normalized to lowercase |
| password_hash | text | Required bcrypt hash; excluded from normal query/API output |
| created_at | timestamp | Managed by Mongoose timestamps |
| updated_at | timestamp | Managed by Mongoose timestamps |

Plaintext passwords are never persisted. The current implementation hashes with bcryptjs using work factor 12. Successful login produces a server-signed JWT in the HttpOnly `arion_auth` cookie with `SameSite=Lax`, an eight-hour expiration, and `Secure` in production. The signing secret comes from `AUTH_SECRET` and is never returned or logged.

Public Patient registration creates AuthAccount, UserProfile with role `patient`, and linked Patient records in one MongoDB transaction. A request body cannot assign Doctor, Staff, or Admin. If an unlinked walk-in candidate already has the same contact number and date of birth, registration stops for later verified account-linking review instead of automatically matching by name or creating a silent duplicate.

## UserProfile

| Field | Type | Notes |
|---|---|---|
| id | identifier, PK | MongoDB `_id`; referenced by AuthAccount and role-specific profiles |
| display_name | text | User's full/display name |
| role | enum | `patient`, `doctor`, `staff`, `admin` |
| contact_number | text | Common contact number for the account holder |
| status | enum | `active`, `inactive` only |
| created_at | timestamptz | Defaults to `now()` |
| updated_at | timestamptz | Updated when profile changes |

`display_name` and `contact_number` belong in UserProfile for account holders. `Patient.full_name` and `Patient.contact_number` remain in Patient so walk-ins can exist without a UserProfile. Account contact information does not replace Patient contact information.

### Account lifecycle

- Use `UserProfile.status = inactive` to deactivate account access instead of hard-deleting an account. Inactive accounts must not be allowed to log in; application access must respect this status.
- Admin can deactivate and reactivate Doctor accounts, Staff accounts, and Patient portal access. Reactivation sets the existing account's status to `active`.
- Deactivation preserves UserProfile and the related Patient, Doctor, and Staff records. It must not delete Appointment, MedicalRecord, Prescription, or MedicalCertificate history or their existing relationships.
- Admin must not delete historical clinical data. Account lifecycle actions must not cascade-delete related records.
- Reactivating or relinking a returning Patient's account access must preserve the existing `Patient.id`. After identity verification, reuse the existing Patient and link account access through `user_profile_id` when needed; do not create a second medical-history identity.
- These are requirements for backend implementation; the current frontend mock does not enforce the production account lifecycle.

### Protected access and post-login navigation

After successful authentication, active accounts navigate by role: Patient to `/patient/dashboard`, Doctor to `/doctor/dashboard`, Staff to `/staff/dashboard`, and Admin to `/admin/dashboard`. This redirect is navigation only.

Every protected request and route must independently require:

1. an authenticated user;
2. `UserProfile.status = active`; and
3. the role permitted for the requested route group.

`/patient/*`, `/doctor/*`, `/staff/*`, and `/admin/*` are restricted to their matching roles. Unauthenticated users are redirected to `/login`; authenticated users with the wrong role are sent to `/unauthorized` or denied. Inactive accounts receive no normal portal access.

Frontend guards must be combined with future backend authorization and database access controls. Supabase RLS may provide part of those controls when Supabase is selected. UI visibility and redirect logic alone do not protect data. Authentication establishes identity; authorization limits allowed actions and records.

---

## Patient

| Field | Type | Notes |
|---|---|---|
| id | uuid, PK | Defaults to `gen_random_uuid()`; independent of the account UUID |
| user_profile_id | uuid, FK, nullable, unique | References `UserProfile.id`; null for guest/walk-in patients |
| full_name | text | Patient's full name, stored independently of any portal account |
| dob | date | Used to determine senior status |
| sex | text | Project-defined value |
| contact_number | text | Patient contact number |
| address | text, nullable | Optional patient address |
| emergency_contact_name | text, nullable | Optional emergency contact name |
| emergency_contact_number | text, nullable | Optional emergency contact number |
| emergency_contact_relationship | text, nullable | Optional emergency contact relationship to the patient |
| allergies | text[] | Optional; defaults to empty array |
| is_pwd | boolean | Self-reported PWD status; default false |

A Patient can exist without a UserProfile or authentication account. Staff can register a guest/walk-in patient with `user_profile_id = null`.

`full_name` belongs to Patient so a walk-in's name does not depend on a UserProfile. `contact_number`, optional `address`, and the three optional emergency contact fields also belong to Patient. The separate emergency contact fields replace the former single `emergency_contact` field.

For a registered patient, `user_profile_id` links to a UserProfile with the `patient` role. Each Patient has at most one linked UserProfile, and each UserProfile can link to at most one Patient. Multiple guest patients can have a null `user_profile_id`.

If a returning walk-in later receives a portal account, an authorized process can verify the patient's identity and set the existing `Patient.user_profile_id` to the new patient-role `UserProfile.id`. Do not create a replacement Patient or change `Patient.id`. Existing Appointment, MedicalRecord, and MedicalCertificate relationships continue to reference the same Patient through `patient_id`.

### Derived values

Senior status must be calculated from `dob`; do not add a stored `is_senior` field or allow manual selection. `is_pwd` remains stored in Patient.

---

## Doctor

| Field | Type | Notes |
|---|---|---|
| id | identifier, PK | MongoDB `_id` |
| user_profile_id | identifier, FK, unique | Required reference to `UserProfile.id` |
| specialty | text | Doctor specialty |
| license_number | text | Doctor license number; later displayed on issued medical certificates |
| ptr_number | text | Doctor PTR number; later displayed on issued medical certificates |
| signature_path | text | Reference to the doctor's securely stored signature image; not image binary |

Doctor contains only the fields above. `display_name`, `contact_number`, and account `status` come from the linked UserProfile through `Doctor.user_profile_id`; do not duplicate them in Doctor. Doctor has no password or username fields.

The signature image must be stored in protected object/file storage. Supabase Storage is one option when that provider is selected. `signature_path` stores only its reference; the actual image binary must not be stored in Doctor.

Doctors manage their own availability through the existing `/doctor/schedule` workflow under the scheduling rules below. Saved medical records and issued medical certificates remain read-only; these profile fields do not authorize editing historical clinical documents.

---

## Staff

| Field | Type | Notes |
|---|---|---|
| id | identifier, PK | MongoDB `_id` |
| user_profile_id | identifier, FK, unique | Required reference to `UserProfile.id` |

Authentication remains outside the Staff model. Staff has no username or authentication fields. Shared display name, contact number, role, and account status belong in UserProfile.

---

# 2. Scheduling

## DoctorAvailability

Represents the doctor's regular recurring weekly working schedule, managed by that doctor. A doctor may have multiple availability ranges for the same `day_of_week`. For example, 09:00-12:00 and 13:00-17:00 leaves a recurring lunch break between the ranges. This is the preferred representation for a regular lunch break or other recurring break and does not require DoctorBlockedTime. These example ranges are illustrative DoctorAvailability values, not fixed clinic operating hours.

| Field | Type | Notes |
|---|---|---|
| id | uuid, PK | Defaults to `gen_random_uuid()` |
| doctor_id | uuid, FK | References `Doctor.id` |
| day_of_week | smallint | Day number such as 0-6 |
| start_time | time | Start of available period |
| end_time | time | End of available period |
| is_active | boolean | Allows the availability slot to be disabled |

Example:

```text
Doctor: Dr. Maria Santos
Monday
08:00 - 12:00

Monday
13:00 - 16:00
```

---

## DoctorPublishedAvailability

Represents a date-specific time range the Doctor has actually published for patient booking. It is separate from the recurring weekly DoctorAvailability template.

| Field | Type | Notes |
|---|---|---|
| id | identifier, PK | MongoDB `_id` |
| doctor_id | identifier, FK | References `Doctor.id` |
| availability_date | date | Specific published calendar date |
| start_time | time | Start of the published range |
| end_time | time | End of the published range; must be later than `start_time` |
| created_at | timestamp | Managed by Mongoose timestamps |
| updated_at | timestamp | Managed by Mongoose timestamps |

A Doctor may publish multiple non-overlapping ranges for one date. The 30-day publication horizon and clinic-hours boundary are service rules; the 14-day patient booking window is a separate service rule.

---

## DoctorBlockedTime

Represents one-time or temporary exceptions to the regular schedule. A block can cover a whole day or part of a day, such as leave, a meeting, a conference, clinic closure, an emergency absence, a personal break, a temporary lunch-time change, or another one-time unavailable period.

| Field | Type | Notes |
|---|---|---|
| id | uuid, PK | Defaults to `gen_random_uuid()` |
| doctor_id | uuid, FK | References `Doctor.id` |
| start_at | timestamptz | Start of the blocked interval |
| end_at | timestamptz | End of the blocked interval |
| reason | text | Reason for the one-time unavailability |

---

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

The approved DoctorAvailability fields describe weekly recurrence and do not record specific published dates. `is_active` enables/disables a weekly period; it must not be treated as proof that all dates in the next 30 days were published. Date-specific publication is stored in DoctorPublishedAvailability.

Clinic operating-hour values remain intentionally TBD. The backend exposes optional `CLINIC_OPEN_TIME` and `CLINIC_CLOSE_TIME` configuration values; both must be configured together as ordered 30-minute `HH:MM` values. When absent, no invented clinic-hours restriction is applied. No Clinic entity is introduced.

The approved patient booking window is up to 14 days ahead. The doctor publication limit remains 30 days and must not be used as the patient booking limit.

Appointment `created_by` is a nullable reference to `UserProfile.id`. It stores the authenticated account that originally created the Appointment. Patient self-booking uses the authenticated Patient UserProfile ID, and the future Staff walk-in API must use the authenticated Staff UserProfile ID. Imported, system-generated, or legacy records may use null when no authenticated creator exists. Account deactivation preserves the reference and Appointment history.

Backend scheduling uses `CLINIC_TIME_ZONE`, with `Asia/Manila` as the current centralized development default. DoctorPublishedAvailability `availability_date` is a date-only calendar value normalized to UTC midnight for storage; its `start_time` and `end_time` are interpreted in the configured clinic timezone. Appointment and DoctorBlockedTime fields remain absolute timestamps. Patient slot generation and booking must use the same conversion boundary.

### Patient appointment booking rules

Patient booking is limited to up to 14 days ahead. Doctor publication remains up to 30 days ahead; doctors need not publish all 30 days. Publication beyond the patient window does not make those dates bookable by patients yet.

A patient slot is bookable only when all conditions hold:

1. The date is within the next 14 days.
2. The selected doctor has actually published availability for that date/time.
3. The full 30-minute slot falls within that published availability and, once defined, the configured clinic operating hours.
4. The slot does not overlap DoctorBlockedTime.
5. No other active appointment occupies that doctor's slot.

The same doctor must not have two active appointments in the same 30-minute slot. Different doctors may have appointments at the same time.

The backend exposes only explicitly published slots within the Patient's 14-day horizon. It subtracts DoctorBlockedTime and appointments with `pending`, `confirmed`, or `completed` status. A new block overlapping one of those active appointments is rejected; schedule changes do not delete, move, or cancel existing Appointments.

### Fixed MVP visit types

- General Consultation
- Follow-up
- Check-up

These are the only approved fixed MVP visit types. Appointment stores them in `visit_type` with canonical values `general_consultation`, `follow_up`, and `check_up`. Do not create a Service or Department table, and do not conflate visit type with the free-text reason for visit.

### Normal walk-in appointment flow

Staff selects an existing Patient or registers a new walk-in Patient, creates a same-day Appointment, and checks the patient in. The patient enters the queue and the doctor consults through the normal appointment flow. MedicalRecord normally links to that Appointment through appointment_id. A portal account is not required. Nullable appointment_id remains for exceptional/manual records, not the normal walk-in flow.


---

## Appointment

Replaces the previous `Schedule` entity.

| Field | Type | Notes |
|---|---|---|
| id | uuid, PK | Defaults to `gen_random_uuid()` |
| patient_id | uuid, FK | References `Patient.id` |
| doctor_id | uuid, FK | References `Doctor.id` |
| appointment_at | timestamptz | Scheduled appointment date/time |
| check_in_at | timestamptz, nullable | Actual patient check-in time |
| status | enum | `pending`, `confirmed`, `completed`, `cancelled`, `no_show` |
| visit_type | enum | `general_consultation`, `follow_up`, `check_up` |
| reason | text | Reason for visit |
| priority | enum | `normal`, `urgent` |
| created_by | identifier, FK, nullable | References `UserProfile.id`; authenticated creator account, or null only for imported/system/legacy records without a known creator |
| created_at | timestamptz | Defaults to `now()` |
| updated_at | timestamptz | Updated when changed |

Mongoose declares a partial unique index on `(doctor_id, appointment_at)` for `pending`, `confirmed`, and `completed` appointments. `cancelled` and `no_show` appointments do not reserve the slot. This enforces one blocking appointment per Doctor per exact 30-minute slot while allowing different Doctors to use the same time.

`patient_id` identifies the Patient receiving care. `doctor_id` identifies the Doctor assigned to the consultation. `created_by` independently identifies the UserProfile account that created the Appointment. Store only the UserProfile reference, never copied names, roles, emails, or credentials. `created_by` is not cleared when that account becomes inactive, and no account lifecycle action may cascade-delete the Appointment.

### Consultation completion rules

- Only the Doctor referenced by `Appointment.doctor_id` may change an eligible consultation to `completed`.
- In the normal scheduled and walk-in flow, a linked saved MedicalRecord is required before Doctor completion.
- `cancelled`, `no_show`, and already `completed` Appointments cannot transition to `completed`.
- Staff may confirm or cancel eligible Appointments and mark eligible unattended Appointments `no_show`, but Staff may not set `completed`.
- `Appointment.status` is the single shared status read by Doctor, Staff, and Patient views. Do not add role-specific completion fields.
- A completed Appointment is no longer part of the active waiting queue. Queue priority and check-in ordering remain unchanged.

### Queue priority

Queue ordering for checked-in patients follows these three tiers:

1. Urgent
2. Senior / PWD
3. Normal

- Senior and PWD share one priority tier. A patient who is both Senior and PWD remains in that single tier and receives no additional or duplicate priority.
- Senior status is derived from `Patient.dob`; do not add or store an `is_senior` field and do not allow manual senior assignment.
- PWD status comes from `Patient.is_pwd`.
- Pregnancy does not have a separate queue priority or status. A case that qualifies as urgent under clinic policy uses the existing Appointment `priority = urgent`; otherwise it follows the Senior/PWD or Normal rules.
- Appointment priority values remain only `normal` and `urgent`. Senior/PWD is a derived queue tier, not another Appointment priority value.

Within the same priority tier:

1. Order by `check_in_at`; earlier check-in goes first.
2. If `check_in_at` is unavailable where a fallback is required, use `appointment_at` consistently.

Do not order the queue by Appointment `created_at`.

### Check-in rules

- Normal check-in is allowed only for an eligible Appointment. With the approved statuses, `pending` and `confirmed` may be eligible; `cancelled`, `completed`, and `no_show` are not eligible for normal check-in.
- Checking in sets `Appointment.check_in_at`, after which the patient enters the waiting queue.
- Prevent duplicate check-in: normal check-in requires `check_in_at` to be null and must not replace an existing check-in timestamp.
- Walk-ins follow the same rules. Staff first selects or registers the Patient, creates the same-day Appointment, and then checks the patient in. Queue placement uses Urgent -> Senior/PWD -> Normal and the same within-tier timestamp ordering.
- These rules introduce no additional queue fields or priority values.

---

# 3. Medical Records

## MedicalRecord

Replaces the previous generic `Records` entity.

| Field | Type | Notes |
|---|---|---|
| id | uuid, PK | Defaults to `gen_random_uuid()` |
| patient_id | uuid, FK | References `Patient.id` |
| doctor_id | uuid, FK | References `Doctor.id` |
| appointment_id | uuid, FK, nullable | References `Appointment.id`; normally linked for scheduled and walk-in consultations; nullable for exceptional/manual records |
| encounter_at | timestamptz | Consultation/record date and time |
| diagnosis | text | Clinical diagnosis |
| notes | text, nullable | Doctor's notes |
| follow_up | text, nullable | Follow-up recommendation |
| created_at | timestamptz | Defaults to `now()` |
| updated_at | timestamptz | Updated when changed |

Normal scheduled and walk-in consultations link MedicalRecord to their Appointment. Walk-ins use a same-day appointment. A MedicalRecord may have `appointment_id = null` only for exceptional/manual records outside the normal appointment flow.

Mongoose uses a partial unique index on non-null `appointment_id`, enforcing one MedicalRecord for a normal Appointment while allowing multiple exceptional records with a null appointment link.

Once saved, a MedicalRecord is read-only. Doctors may create a record for an eligible consultation that does not already have one and may view permitted saved records, but they may not edit or delete saved records. Staff receives only the limited read-only projection described in the security section, and Admin has no clinical editing permission.

---

## Prescription

A medical record can have multiple prescriptions.

| Field | Type | Notes |
|---|---|---|
| id | uuid, PK | Defaults to `gen_random_uuid()` |
| medical_record_id | uuid, FK | References `MedicalRecord.id` |
| medicine | text | Medicine name |
| dosage | text | Dose, strength, frequency |
| instructions | text, nullable | Patient instructions |
| created_at | timestamp | Managed by Mongoose timestamps |
| updated_at | timestamp | Managed by Mongoose timestamps |

Example:

```text
MedicalRecord
├── Paracetamol 500 mg
└── Cetirizine 10 mg
```

---

# 4. Medical Certificates

## MedicalCertificate

| Field | Type | Notes |
|---|---|---|
| id | uuid, PK | Defaults to `gen_random_uuid()` |
| medical_certificate_number | text, unique | Required unique certificate identifier; exact numbering format is not yet finalized |
| patient_id | uuid, FK | References `Patient.id` |
| doctor_id | uuid, FK | References `Doctor.id`; certificate signer |
| medical_record_id | uuid, FK, nullable | References `MedicalRecord.id` |
| date_issued | date | Required certificate issue date |
| purpose | text | Example: Fit to Work, Sick Leave |
| diagnosis_summary | text | Patient-facing summary |
| valid_until | date, nullable | Optional expiration date |
| status | enum | `draft`, `issued` |
| created_at | timestamptz | Defaults to `now()` |
| updated_at | timestamptz | Updated when changed |

`medical_certificate_number` must be unique. Its exact numbering format is intentionally deferred. QR and public-verification behavior remain outside the approved MVP.

Patient and Doctor relationships are required and must be preserved. `medical_record_id` remains nullable; when present, it links the certificate to the related MedicalRecord. A single MedicalRecord may produce multiple certificates if necessary.

Certificate display/generation reads `Doctor.license_number`, `Doctor.ptr_number`, and the signature image referenced by `Doctor.signature_path` from the linked Doctor. Do not duplicate those values inside MedicalCertificate for the current MVP. `signature_path` remains a reference only; raw image binary is not stored in Doctor. The real image must be held in protected object/file storage, and access must be restricted to the intended authenticated certificate flow rather than publicly exposed.

Clinic location is required for certificate display/generation and is treated as simple application/global configuration for the MVP. Do not add a clinic-management entity or duplicate clinic location in MedicalCertificate.

Certificate lifecycle rules:

- Status values remain only `draft` and `issued`.
- Draft certificates may exist only during the approved Doctor creation flow at `/doctor/records/:id/certificate/new`.
- Once status becomes `issued`, the certificate is read-only. The MVP provides no Edit, Update, Delete, Reissue, or Modify action for an issued certificate.
- Patients and Staff cannot edit certificates. Admin cannot edit certificate clinical content. Doctors issue certificates only through the approved creation flow.
- QR verification, public certificate verification, external sharing, advanced digital-signature infrastructure, payment integration, and real PDF generation remain future scope.

Example:

```text
MedicalRecord
├── Fit-to-Work Certificate
└── Sick Leave Certificate
```

If the final project requires only one certificate per medical record, a unique constraint can later be placed on `medical_record_id`. That constraint is not part of the current approved structure.

---

# 5. Recommended Constraints

## Authentication

`AuthAccount.user_profile_id` is a required unique ObjectId reference to UserProfile. AuthAccount email is also unique after lowercase normalization. `password_hash` is excluded from normal query selection and never appears in API responses.

Account lifecycle uses UserProfile deactivation, not deletion of AuthAccount or UserProfile. Do not configure account deletion to cascade into application profiles or history. Preserve related Patient, Doctor, Staff, Appointment, MedicalRecord, Prescription, and MedicalCertificate records and references.

---

## Patient account link

`Patient.id` is its own UUID primary key, not a foreign key to UserProfile.

`Patient.user_profile_id` is a nullable foreign key to `UserProfile.id` with a unique constraint on non-null values. This allows multiple guest/walk-in patients without accounts while preventing one account from linking to multiple Patient records.

## Appointment conflicts

Prevent the same doctor from having overlapping active appointments.

For the MVP, use one patient per doctor per 30-minute appointment slot. Already-booked slots cannot be booked again for that doctor; different doctors may use the same time slot. Published availability and blocked-time checks must also pass.

---

## Medical record per appointment

For the selected Mongoose implementation, one non-null appointment link produces at most one MedicalRecord:

```text
UNIQUE(appointment_id)
```

when `appointment_id` is not null. This is implemented as a partial unique index so null exceptional/manual links do not conflict.

Exceptional/manual records outside the normal appointment flow may have:

```text
appointment_id = null
```

---

## Enums

Enforce these allowed values at the persistence boundary. A PostgreSQL implementation may use enums or CHECK constraints; another datastore must provide equivalent validation.

### User Role

```text
patient
doctor
staff
admin
```

### Account Status (UserProfile)

```text
active
inactive
```

These are the only MVP account statuses. Appointment and certificate statuses below describe their own entities, not account lifecycle.

### Appointment Status

```text
pending
confirmed
completed
cancelled
no_show
```

### Appointment Priority

```text
normal
urgent
```

### Certificate Status

```text
draft
issued
```

---

## Timestamps

Use:

```text
created_at DEFAULT now()
```

and update:

```text
updated_at
```

through application logic or an equivalent datastore mechanism.

---

# 6. Security and Authorization

Enforce these rules in the backend and persistence layer. Use Supabase Row Level Security when Supabase is selected; an Express implementation must enforce equivalent authorization in the API and data-access layers.

General intended permissions:

Account-based access requires an active UserProfile in addition to the role and ownership rules below. Inactive accounts must not be allowed to log in or retain application access merely because their historical profile and role links remain intact.

## Patient

Portal ownership is determined by matching `Patient.user_profile_id` to the authenticated UserProfile ID, not by comparing `Patient.id` to the authentication identity. In Supabase this authenticated ID is available as `auth.uid()`. Related appointments, records, and certificates are matched through their `patient_id` to that Patient. A null account link grants no patient portal access; Staff and Doctor access remains governed by their role permissions.

Can access:
- own profile
- own appointments
- own medical records
- own certificates

## Doctor

Can access:
- own schedule
- assigned patient information
- permitted medical records
- certificates they issue

Doctors manage their own recurring availability and blocked time through the existing `/doctor/schedule` workflow under the scheduling rules above. The assigned Doctor may mark an eligible consultation completed only after its linked MedicalRecord has been saved. Saved medical records and issued medical certificates are read-only.

## Staff

Staff access follows least privilege. Backend authorization and database access controls must enforce these permissions at the data-access layer; hiding buttons or routes in the UI is not sufficient.

Staff may access operational information needed to:

- view the Staff Dashboard and clinic calendar;
- view operational Appointment details;
- confirm or cancel eligible Appointments where appropriate;
- search Patients and view basic Patient information needed for operations;
- register walk-in Patients and create same-day walk-in Appointments;
- check in eligible Patients and manage the queue; and
- mark eligible unattended Appointments as `no_show`.

When operationally necessary, Staff may read only this limited MedicalRecord projection:

- patient name;
- `MedicalRecord.encounter_at`;
- attending Doctor; and
- a short diagnosis summary derived from `MedicalRecord.diagnosis`.

Staff must not access detailed `MedicalRecord.notes`, full Prescription details, MedicalCertificate contents, or sensitive clinical narrative beyond the approved short diagnosis summary. Detailed clinical information remains Doctor-only.

Staff must not create, edit, or delete MedicalRecords; create or edit Prescriptions; issue, edit, or delete MedicalCertificates; modify Doctor clinical decisions; edit Patient clinical history; or manage Doctor, Staff, or Admin accounts.

Staff must not mark an Appointment `completed`. Staff may read the resulting shared status after the assigned Doctor completes the consultation.

The limited diagnosis summary is an authorization/view boundary, not a new schema field.

## Admin

Can manage:
- Doctor account provisioning and active/inactive lifecycle
- Staff account provisioning and active/inactive lifecycle
- Patient portal access through `/admin/patients`
- approved non-clinical account administration

Admin can deactivate/reactivate Doctor accounts, Staff accounts, and Patient portal access through UserProfile status. This does not grant permission to delete historical clinical data. Deactivation preserves the related profiles and all appointment, medical record, prescription, and certificate history.

For Patient account administration, Admin may read only the basic account/profile data needed for the operation: `Patient.id`, `Patient.full_name`, `Patient.contact_number`, `Patient.user_profile_id`, and the linked UserProfile's `contact_number`, `status`, and `created_at` where present. A null `Patient.user_profile_id` means no portal account and is not a third UserProfile status.

Admin may change the linked UserProfile status only between `active` and `inactive`. Deactivation blocks portal access but must not unlink or delete UserProfile, Patient, Appointment, MedicalRecord, Prescription, or MedicalCertificate data. Reactivation and appropriate relinking must preserve the same `Patient.id` and must not create another medical-history identity.

Admin must not create or edit diagnoses, MedicalRecords, doctor notes, Prescriptions, or MedicalCertificates; issue certificates; alter Doctor clinical decisions; or permanently delete Patient clinical history.

Backend authorization and database access controls must enforce this limited account-administration projection and mutation boundary. UI hiding alone is not authorization.

---

# 7. Backend Portability

Do not call a database, Supabase, or another provider directly throughout React components.

Use service modules such as:

```text
services/
├── authService
├── appointmentService
├── patientService
├── medicalRecordService
├── certificateService
└── doctorAvailabilityService
```

Supported backend boundary:

```text
React
  ↓
Service Layer
  ↓
Backend Adapter or API
```

One implementation may use Supabase behind the service layer. Another may use:

```text
React
  ↓
Service Layer
  ↓
Express API
  ↓
MongoDB
```

The backend choice is not finalized. This section defines the boundary only; it does not design Express endpoints, MongoDB collections, or provider-specific authentication.
