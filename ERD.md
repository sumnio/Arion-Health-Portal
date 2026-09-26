# Arion Health Portal - Revised ERD

This ERD is the logical and relational reference model. UUID and PostgreSQL-specific default notation is retained pending the backend decision; it does not require Supabase as the only implementation and is not a MongoDB collection design.

## Entity Overview

The Arion Health Portal contains the following main entities and external identity relationship:

- AuthAccount
- UserProfile
- Patient
- Doctor
- Staff
- DoctorAvailability
- DoctorPublishedAvailability
- DoctorBlockedTime
- Appointment
- MedicalRecord
- Prescription
- MedicalCertificate

---

# Authentication Structure

AuthAccount handles credentials for portal accounts. Passwords, including password hashes, must not be stored in UserProfile, Patient, Doctor, or Staff. Guest/walk-in Patient records do not require an AuthAccount or UserProfile.

AuthAccount owns normalized email and the bcrypt password hash. UserProfile owns application identity, role, common contact information, and active/inactive status. Real login is shared across all four roles and never asks the user to select a role.

```text
AuthAccount
    │
    │ 1:1
    ▼
UserProfile
```

`UserProfile` stores application identity, role, common contact information, and account status, not authentication credentials.

A UserProfile may correspond to one role-specific profile. In the Mongoose implementation, Doctor and Staff have their own `_id` plus a required unique `user_profile_id` reference. Patient has its own `_id` and a nullable, unique `user_profile_id` reference.

Admin is represented by `UserProfile.role = admin`; there is no separate Admin entity.

Public `/register` creates Patient access only. Admin provisions Doctor and Staff accounts, while the Admin account is provisioned separately. Patient self-registration cannot assign or promote to another role.

```text
UserProfile 0..1 ─── 0..1 Patient
                via Patient.user_profile_id (nullable, unique)

UserProfile 1 ─── 0..1 Doctor
                via Doctor.user_profile_id
UserProfile 1 ─── 0..1 Staff
                via Staff.user_profile_id
```

AuthAccount fields are `id`, unique `user_profile_id`, unique normalized `email`, `password_hash`, `created_at`, and `updated_at`. The hash is excluded from normal queries and all API responses.

Authentication uses a server-signed JWT stored in an HttpOnly cookie. Password hashes stay in AuthAccount; cookie/token validation establishes identity, while UserProfile status and later role authorization determine access.

Relationship:

```text
AuthAccount 1 ─── 1 UserProfile
```

```text
UserProfile 0..1 ─── 0..1 Patient
UserProfile 1 ─── 0..1 Doctor
UserProfile 1 ─── 0..1 Staff
```

### Protected access

The Auth-to-UserProfile relationship supplies three separate checks for protected access: an authenticated Auth user, an active UserProfile, and the role permitted for the route. Patient, Doctor, Staff, and Admin route groups accept only their matching roles. Unauthenticated access redirects to `/login`; a wrong-role account is sent to `/unauthorized` or denied; an inactive account receives no normal portal access.

Post-login role redirects lead to the matching dashboard but provide navigation only. Frontend route guards do not replace backend authorization and database access controls. Supabase RLS is one possible enforcement mechanism when that provider is selected. Hiding UI controls is not sufficient.

The former mock role selector and preview-exit controls have been removed. The frontend restores the authenticated session through `/api/auth/me`.

---

# UserProfile Structure and Account Lifecycle

The UserProfile fields match `SCHEMA.md`:

| Field | Type | Notes |
|---|---|---|
| id | identifier, PK | MongoDB `_id`; referenced by AuthAccount and role-specific profiles |
| display_name | text | User's full/display name |
| role | enum | `patient`, `doctor`, `staff`, `admin` |
| contact_number | text | Common contact number for the account holder |
| status | enum | `active`, `inactive` only |
| created_at | timestamptz | Defaults to `now()` |
| updated_at | timestamptz | Updated when profile changes |

`display_name` and `contact_number` belong in UserProfile for account holders. Patient retains its own `full_name` and `contact_number` so a walk-in can exist without an account. Account contact information does not replace Patient contact information.

Doctor and Staff contain no username-based authentication fields. Shared account fields belong in UserProfile.

- The only MVP account statuses are `active` and `inactive`.
- Use deactivation instead of hard deletion. Inactive accounts must not be allowed to log in or retain application access based solely on their preserved role/profile links.
- Admin can deactivate/reactivate Doctor accounts, Staff accounts, and Patient portal access. Reactivation sets the existing UserProfile status to `active`.
- Deactivation preserves UserProfile and related Patient, Doctor, and Staff records, along with Appointment, MedicalRecord, Prescription, and MedicalCertificate history and relationships. Account lifecycle must not cascade-delete them, and Admin must not delete historical clinical data.
- Reactivating or relinking a returning Patient's account access keeps the same `Patient.id`. Verify identity and reuse the existing Patient, updating `user_profile_id` when needed; do not create a second medical-history identity.

These rules are provider-independent implementation requirements.

---

# Staff Structure

The Staff fields match `SCHEMA.md`:

| Field | Type | Notes |
|---|---|---|
| id | identifier, PK | MongoDB `_id` |
| user_profile_id | identifier, FK, unique | Required reference to `UserProfile.id` |

Staff display name, contact number, role, and account status come from UserProfile. Authentication credentials do not belong in Staff.

---

# Patient Structure

The Patient fields match `SCHEMA.md`:

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

The three emergency contact fields replace the former single `emergency_contact` field. Senior status is derived from `dob`; there is no stored `is_senior` field and no manual senior selection.

Walk-in patients can exist with `user_profile_id = null` and do not require a UserProfile or authentication account. Their name and contact information live in Patient. Non-null account links reference a UserProfile with role `patient`; each Patient has at most one linked UserProfile and each UserProfile links to at most one Patient.

If a returning walk-in later receives a portal account, verify their identity and link the new UserProfile through the existing `Patient.user_profile_id`. Keep the same `Patient.id`; do not create a replacement Patient. Appointment, MedicalRecord, and MedicalCertificate continue to reference that same Patient through `patient_id`.

## Admin Patient account-management boundary

The `/admin/patients` route uses the existing nullable, unique `Patient.user_profile_id` relationship for account administration; it adds no entity or relationship.

- Admin may view `Patient.full_name` and `Patient.contact_number` plus basic linked UserProfile information required for administration, including `status` and `created_at`.
- A Patient with `user_profile_id = null` has no portal account. This is distinct from the only two account statuses, `active` and `inactive`.
- Deactivation changes the linked UserProfile status to `inactive`; reactivation changes the same profile back to `active`. The Patient-to-UserProfile link and `Patient.id` remain unchanged.
- Appointment, MedicalRecord, Prescription, and MedicalCertificate history remains linked and must not be deleted.
- Admin cannot edit diagnoses, MedicalRecords, doctor notes, Prescriptions, MedicalCertificates, or Doctor clinical decisions, and cannot permanently delete Patient clinical history.
- Backend authorization and database access controls must enforce this account-only boundary; hiding UI controls is insufficient.

---

# Patient and Appointment

A patient can have many appointments.

```text
Patient
   │
   │ 1
   │
   │ *
   ▼
Appointment
```

Relationship:

```text
Patient 1 ─── * Appointment
```

## Staff access boundary

Staff has no ownership relationship with MedicalRecord, Prescription, or MedicalCertificate. Staff access is role-based and follows least privilege.

- Staff may use basic Patient and Appointment information for calendar, appointment confirmation/cancellation, patient search, walk-in registration, same-day Appointment creation, check-in, queue management, and eligible no-show updates. Staff cannot mark a consultation completed.
- When operationally necessary, Staff may read only patient name, encounter date, attending Doctor, and a short diagnosis summary from the related MedicalRecord.
- Staff must not see detailed doctor notes, full Prescription details, MedicalCertificate contents, or sensitive clinical narrative beyond the short diagnosis summary.
- Staff cannot create, edit, or delete MedicalRecords; create or edit Prescriptions; issue, edit, or delete MedicalCertificates; modify Doctor clinical decisions; edit Patient clinical history; or manage Doctor, Staff, or Admin accounts.
- Backend authorization and database access controls must enforce this boundary. UI visibility alone is not authorization.

This permission note changes no entity relationship or schema field. The short diagnosis summary is a limited projection of existing diagnosis data, not a new field.

## Queue and check-in behavior

The waiting queue is derived from Appointment and Patient data; the approved model has no separate queue entity or additional queue fields.

1. Urgent
2. Senior / PWD
3. Normal

- Senior and PWD share the same tier. A patient who qualifies for both appears once in that tier and receives no double priority.
- Senior status is derived from `Patient.dob`; there is no stored or manually assigned `is_senior` field. PWD status comes from `Patient.is_pwd`.
- Pregnancy does not create a separate priority or status. Cases that meet clinic urgent criteria use the existing `Appointment.priority = urgent`; otherwise the standard derived tier applies.
- `Appointment.priority` remains limited to `normal` and `urgent`; Senior/PWD is a derived queue tier.
- Within a tier, order by `Appointment.check_in_at`, with earlier check-in first. Where a fallback is required because `check_in_at` is unavailable, use `Appointment.appointment_at` consistently. Never use `Appointment.created_at` for queue ordering.
- Normal check-in applies only to eligible Appointments. `pending` and `confirmed` may be eligible; `cancelled`, `completed`, and `no_show` are not eligible.
- Check-in sets `Appointment.check_in_at` and places the patient in the waiting queue. Requiring that `check_in_at` is null prevents duplicate check-in and preserves the original timestamp.
- Walk-in patients use the same behavior after staff creates their same-day Appointment: Urgent -> Senior/PWD -> Normal, then check-in time within the tier.
- Only the Doctor assigned through `Appointment.doctor_id` may mark an eligible consultation `completed`, normally after saving its linked MedicalRecord. Completion removes the patient from the active waiting queue. Staff and Patient views read that same Appointment status.

---

# Doctor Structure

The Doctor fields match `SCHEMA.md`:

| Field | Type | Notes |
|---|---|---|
| id | identifier, PK | MongoDB `_id` |
| user_profile_id | identifier, FK, unique | Required reference to `UserProfile.id` |
| specialty | text | Doctor specialty |
| license_number | text | Doctor license number; later displayed on issued medical certificates |
| ptr_number | text | Doctor PTR number; later displayed on issued medical certificates |
| signature_path | text | Reference to the doctor's securely stored signature image; not image binary |

Doctor contains only these fields. Display name, contact number, and account status come from `UserProfile.display_name`, `UserProfile.contact_number`, and `UserProfile.status` through `Doctor.user_profile_id`. They are not duplicated in Doctor. Doctor has no password or username fields.

The actual signature image must be stored in protected object/file storage; Supabase Storage is one option when that provider is selected. Doctor stores only `signature_path`, never the image binary. License and PTR numbers will appear on issued medical certificates. Saved medical records and issued medical certificates remain read-only.

Doctors manage their own availability and blocked time through the existing `/doctor/schedule` workflow under the scheduling rules below. No separate availability route is approved.

---

# Doctor and Appointment

A doctor can have many appointments.

```text
Doctor
   │
   │ 1
   │
   │ *
   ▼
Appointment
```

Relationship:

```text
Doctor 1 ─── * Appointment
```

Therefore, Appointment connects Patient and Doctor:

```text
Patient
   │
   │
   ▼
Appointment
   ▲
   │
   │
Doctor
```

---

# Doctor Availability

Represents the doctor's regular recurring weekly working schedule, managed by that doctor. A doctor may have multiple availability ranges for the same `day_of_week`. For example, 09:00-12:00 and 13:00-17:00 leaves a recurring lunch break between the ranges. This is the preferred representation for a regular lunch break or other recurring break and does not require DoctorBlockedTime. These example ranges are illustrative DoctorAvailability values, not fixed clinic operating hours.

| Field | Type | Notes |
|---|---|---|
| id | uuid, PK | Defaults to `gen_random_uuid()` |
| doctor_id | uuid, FK | References `Doctor.id` |
| day_of_week | smallint | Day number such as 0-6 |
| start_time | time | Start of available period |
| end_time | time | End of available period |
| is_active | boolean | Allows the availability slot to be disabled |

A doctor may define multiple availability periods on the same day. Gaps between those ranges represent regular recurring breaks.

```text
Doctor
   │
   │ 1
   │
   │ *
   ▼
DoctorAvailability
```

Relationship:

```text
Doctor 1 ─── * DoctorAvailability
```

---

# Doctor Published Availability

DoctorPublishedAvailability stores the date-specific ranges a Doctor has actually published for booking.

| Field | Type | Notes |
|---|---|---|
| id | identifier, PK | MongoDB `_id` |
| doctor_id | identifier, FK | References `Doctor.id` |
| availability_date | date | Specific published calendar date |
| start_time | time | Start of published range |
| end_time | time | End of published range; later than `start_time` |
| created_at | timestamp | Managed by Mongoose timestamps |
| updated_at | timestamp | Managed by Mongoose timestamps |

Relationship: Doctor 1 -> many DoctorPublishedAvailability, via `DoctorPublishedAvailability.doctor_id`.

---

# Doctor Blocked Time

Represents one-time or temporary exceptions to the regular schedule. A block can cover a whole day or part of a day, such as leave, a meeting, a conference, clinic closure, an emergency absence, a personal break, a temporary lunch-time change, or another one-time unavailable period.

| Field | Type | Notes |
|---|---|---|
| id | uuid, PK | Defaults to `gen_random_uuid()` |
| doctor_id | uuid, FK | References `Doctor.id` |
| start_at | timestamptz | Start of the blocked interval |
| end_at | timestamptz | End of the blocked interval |
| reason | text | Reason for the one-time unavailability |

Relationship: Doctor 1 -> many DoctorBlockedTime, via DoctorBlockedTime.doctor_id.

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

The approved DoctorAvailability fields describe weekly recurrence and do not record specific published dates. `is_active` enables/disables a weekly period; it must not be treated as proof that all dates in the next 30 days were published. DoctorPublishedAvailability now stores the specific published date and time ranges.

Clinic operating-hour values remain intentionally TBD. Optional `CLINIC_OPEN_TIME` and `CLINIC_CLOSE_TIME` configuration values provide the backend boundary and must be supplied together as ordered 30-minute `HH:MM` values. Blank values mean no clinic-hours restriction is applied. This adds no Clinic entity.

The approved patient booking window is up to 14 days ahead. The doctor publication limit remains 30 days and must not be used as the patient booking limit.

Appointment `created_by` is a nullable reference to `UserProfile.id`. Patient self-booking records the authenticated Patient UserProfile ID, and the future Staff walk-in API records the authenticated Staff UserProfile ID. Imported, system-generated, or legacy Appointments may use null when no authenticated creator is available. Deactivating the creator preserves both the reference and Appointment history.

Scheduling uses the centralized `CLINIC_TIME_ZONE` configuration, currently defaulting to `Asia/Manila` for development. DoctorPublishedAvailability dates are stored as date-only values normalized to UTC midnight; range times are clinic-local. Appointment and DoctorBlockedTime values are absolute timestamps. Both slot lookup and appointment creation use this same conversion boundary.

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

These are the only approved fixed MVP visit types. Appointment stores them in `visit_type` using `general_consultation`, `follow_up`, and `check_up`. Do not create a Service or Department table or conflate visit type with the free-text reason for visit.

### Normal walk-in appointment flow

Staff selects an existing Patient or registers a new walk-in Patient, creates a same-day Appointment, and checks the patient in. The patient enters the queue and the doctor consults through the normal appointment flow. MedicalRecord normally links to that Appointment through appointment_id. A portal account is not required. Nullable appointment_id remains for exceptional/manual records, not the normal walk-in flow.


---

# Appointment Structure

The Appointment fields match `SCHEMA.md`:

| Field | Type | Notes |
|---|---|---|
| id | uuid, PK | Relational reference defaults to `gen_random_uuid()` |
| patient_id | uuid, FK | References `Patient.id` |
| doctor_id | uuid, FK | References `Doctor.id` |
| appointment_at | timestamptz | Scheduled appointment date/time |
| check_in_at | timestamptz, nullable | Actual patient check-in time |
| status | enum | `pending`, `confirmed`, `completed`, `cancelled`, `no_show` |
| visit_type | enum | `general_consultation`, `follow_up`, `check_up` |
| reason | text | Reason for visit |
| priority | enum | `normal`, `urgent` |
| created_by | identifier, FK, nullable | References `UserProfile.id`; authenticated creator account, or null for imported/system/legacy records without a known creator |
| created_at | timestamptz | Relational reference defaults to `now()` |
| updated_at | timestamptz | Updated when changed |

The same Doctor cannot have two blocking Appointments in the same 30-minute slot. Mongoose enforces a partial unique `(doctor_id, appointment_at)` index for `pending`, `confirmed`, and `completed`; `cancelled` and `no_show` do not block the slot. Different Doctors may have Appointments at the same time.

Patient-facing slot generation uses only DoctorPublishedAvailability within 14 days, then removes DoctorBlockedTime overlaps, past slots, and blocking Appointments. Recurring DoctorAvailability is a publication template and is never exposed directly as bookable. Creating a block that overlaps a blocking Appointment is rejected, and deleting schedule rows does not delete or alter Appointment history.

`patient_id`, `doctor_id`, and `created_by` have separate meanings: Patient receiving care, Doctor assigned to the consultation, and UserProfile account that created the Appointment. The creator relationship stores only the UserProfile reference and does not expose or copy authentication credentials. UserProfile deactivation does not null `created_by` and does not delete the Appointment.

---

# Appointment and Medical Record

A scheduled appointment may create one medical record.

```text
Appointment
     │
     │ 0..1
     ▼
MedicalRecord
```

Recommended relationship:

```text
Appointment 1 ─── 0..1 MedicalRecord
```

Normal walk-in consultations use a same-day Appointment, and MedicalRecord normally links to that Appointment. Nullable `appointment_id` supports exceptional/manual records outside the normal flow; it is not the default for walk-ins.

The Mongoose model uses a partial unique index for non-null `appointment_id`, so a normal Appointment has at most one MedicalRecord while exceptional/manual records may retain a null link.

Once saved, a MedicalRecord is read-only. Doctors may create a record for an eligible consultation that does not already have one and may view permitted saved records, but they may not edit or delete saved records. Staff receives only the approved limited read-only projection, and Admin has no clinical editing permission.

For the normal scheduled and walk-in flow, the assigned Doctor saves the linked MedicalRecord and then explicitly marks the Appointment `completed`. A cancelled, no-show, or already completed Appointment cannot be completed. Appointment status is shared across Doctor, Staff, and Patient views; there is no separate role-specific completion field.

Backend ownership follows these relationships: the Doctor is resolved from the authenticated UserProfile, the Appointment must reference that Doctor, and MedicalRecord Patient/Doctor links are copied from the Appointment rather than accepted from the request. Completion additionally requires `Appointment.status = confirmed`, non-null `check_in_at`, and the linked MedicalRecord. These checks add no new fields or relationships.

---

# MedicalRecord Structure

The MedicalRecord fields match `SCHEMA.md`:

| Field | Type | Notes |
|---|---|---|
| id | uuid, PK | Relational reference defaults to `gen_random_uuid()` |
| patient_id | uuid, FK | References `Patient.id` |
| doctor_id | uuid, FK | References `Doctor.id` |
| appointment_id | uuid, FK, nullable | References `Appointment.id`; normally linked, nullable only for exceptional/manual records |
| encounter_at | timestamptz | Consultation/record date and time |
| diagnosis | text | Clinical diagnosis |
| notes | text, nullable | Doctor's notes |
| follow_up | text, nullable | Follow-up recommendation |
| created_at | timestamptz | Relational reference defaults to `now()` |
| updated_at | timestamptz | Updated when changed |

---

# Patient and Medical Record

A patient can have many medical records.

```text
Patient 1 ─── * MedicalRecord
```

---

# Doctor and Medical Record

A doctor can create many medical records.

```text
Doctor 1 ─── * MedicalRecord
```

---

# Medical Record and Prescription

A medical record can contain multiple prescriptions.

```text
MedicalRecord
      │
      │ 1
      │
      │ *
      ▼
Prescription
```

Relationship:

```text
MedicalRecord 1 ─── * Prescription
```

---

# Prescription Structure

The Prescription fields match `SCHEMA.md`:

| Field | Type | Notes |
|---|---|---|
| id | uuid, PK | Relational reference defaults to `gen_random_uuid()` |
| medical_record_id | uuid, FK | References `MedicalRecord.id` |
| medicine | text | Medicine name |
| dosage | text | Dose, strength, frequency |
| instructions | text, nullable | Patient instructions |
| created_at | timestamp | Managed by Mongoose timestamps |
| updated_at | timestamp | Managed by Mongoose timestamps |

Prescriptions remain linked to their MedicalRecord and do not exist as independent clinical records.

---

# Medical Record and Medical Certificate

The MedicalCertificate fields match `SCHEMA.md`:

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

The certificate number is unique; its format is deferred. Patient and Doctor links are required. The MedicalRecord link remains optional and points to the related record when present.

Certificate display reads `Doctor.license_number`, `Doctor.ptr_number`, and the protected signature image referenced by `Doctor.signature_path` from the linked Doctor. These values are not duplicated in MedicalCertificate for the current MVP. `Doctor.signature_path` stores only a path/reference to an image held in protected object/file storage; signature access must not be publicly exposed outside the intended certificate flow.

Clinic location is simple application/global configuration used for certificate display/generation. It is not a MedicalCertificate field and does not create a clinic-management entity.

Drafts exist only during the approved Doctor creation flow. After status becomes `issued`, the certificate is read-only: no Edit, Update, Delete, Reissue, or Modify action is allowed. Patients and Staff cannot edit certificates, and Admin cannot edit certificate clinical content.

The current backend creation endpoint directly persists `issued`, matching the approved UI submission. Certificate numbers are generated server-side and database-unique. Doctor and Patient read endpoints filter by the stored relationship IDs. Responses resolve Doctor credentials and signature availability without exposing the protected `signature_path`.

Issued certificates can be downloaded as PDFs from authenticated Doctor and Patient views using the authorized certificate response. QR verification, public certificate verification, external sharing, advanced digital signatures, payment integration, and server-side PDF generation remain future scope.

A MedicalRecord can have zero or multiple medical certificates.

```text
MedicalRecord
      │
      │ 1
      │
      │ 0..*
      ▼
MedicalCertificate
```

Relationship:

```text
MedicalRecord 1 ─── 0..* MedicalCertificate
```

The `medical_record_id` on a certificate may be nullable if a certificate is not attached to a specific visit.

---

# Patient and Medical Certificate

A patient can have many certificates.

```text
Patient 1 ─── * MedicalCertificate
```

---

# Doctor and Medical Certificate

A doctor can issue many certificates.

```text
Doctor 1 ─── * MedicalCertificate
```

The doctor referenced by `doctor_id` is the certificate signer.

Detailed clinical APIs allow Doctors to read only records and certificates matching their Doctor profile, and Patients only records and issued certificates matching the Patient linked to their authenticated UserProfile. Staff and Admin are denied these detailed endpoints.

---

# Complete Relationship Summary

The Patient branch below is optional in both directions: a Patient can exist independently with `user_profile_id = null`, and a UserProfile can have zero or one linked Patient. Doctor and Staff retain their required UserProfile link. The AuthAccount/UserProfile 1:1 relationship describes provisioned portal accounts.

```text
AuthAccount
    │
    │ 1:1
    ▼
UserProfile
    │
    ├───────────────┬────────────────┐
    │               │                │
    ▼               ▼                ▼
 Patient*         Doctor            Staff
    │               │
    │               ├───────────────┐
    │               │               │
    │               ▼               ▼
    │        DoctorAvailability   Appointment
    │                               ▲
    │                               │
    └──────────── Appointment ───────┘
                    │
                    │ 0..1
                    ▼
              MedicalRecord
               /         \
              /           \
             ▼             ▼
      Prescription   MedicalCertificate
                          ▲
                          │
                  Patient + Doctor
```

Doctor also has one-to-many relationships with DoctorPublishedAvailability for date-specific published ranges and DoctorBlockedTime for one-time schedule exceptions. Blocked intervals override published availability; they do not replace or delete Appointment history.

`Patient*` links through nullable, unique `Patient.user_profile_id`; its own `id` is independent of UserProfile. Admin remains a UserProfile role only.

---

# Relationship List

```text
AuthAccount 1 -> 1 UserProfile

UserProfile 0..1 -> 0..1 Patient (via nullable, unique Patient.user_profile_id)
UserProfile 1 -> 0..1 Doctor
UserProfile 1 -> 0..1 Staff
UserProfile 1 -> 0..many Appointment (via nullable Appointment.created_by)

Patient 1 -> many Appointment
Doctor 1 -> many Appointment

Doctor 1 -> many DoctorAvailability
Doctor 1 -> many DoctorPublishedAvailability
Doctor 1 -> many DoctorBlockedTime

Patient 1 -> many MedicalRecord
Doctor 1 -> many MedicalRecord

Appointment 1 -> 0..1 MedicalRecord

MedicalRecord 1 -> many Prescription

MedicalRecord 1 -> zero-or-many MedicalCertificate

Patient 1 -> many MedicalCertificate
Doctor 1 -> many MedicalCertificate
```

Admin provisioning creates the existing linked AuthAccount, UserProfile, and Doctor/Staff records without introducing another account entity. Deactivate/reactivate changes only `UserProfile.status`; it does not remove or replace any node or relationship in this diagram. A walk-in Patient with no UserProfile link has no portal lifecycle operation.

---

# Walk-in Flow

A walk-in does not need a pre-booked appointment or a portal account. Staff selects an existing Patient or registers a new guest Patient with its own UUID and `user_profile_id = null`. Staff then creates a same-day Appointment. Existing registered patients retain their Patient identity and account link.

```text
Staff selects existing Patient / registers new walk-in Patient
   ↓
Staff creates same-day Appointment
   ↓
Staff checks patient in
   ↓
Patient enters queue
   ↓
Doctor consultation through normal appointment flow
   ↓
MedicalRecord linked to that Appointment
```

The Staff API registers a new walk-in as Patient only (`user_profile_id = null`) and creates no UserProfile/AuthAccount. Its same-day Appointment is immediately `confirmed`, with `created_by` referencing the authenticated Staff UserProfile. Check-in later sets `check_in_at` from server time. No separate walk-in or queue entity is introduced.

The active queue is a projection of current-day confirmed Appointments with non-null `check_in_at`. Ordering derives Urgent -> Senior/PWD -> Normal from Appointment priority and Patient DOB/PWD data, then uses check-in time. No-show and Doctor completion preserve the Appointment but exclude it from this projection.

`MedicalRecord.appointment_id` normally references the same-day Appointment. Null is reserved for exceptional/manual records.

If a guest later registers for the portal, an authorized process can verify the patient's identity and set the existing `Patient.user_profile_id` to the new patient-role UserProfile's ID. Keep `Patient.id` unchanged to preserve all linked appointments, medical records, and certificates.

---

# Scheduled Appointment Flow

```text
Patient
   ↓
Appointment
   ↓
Check-in
   ↓
Doctor
   ↓
MedicalRecord
   ├── Prescription
   └── MedicalCertificate
```
