# Arion Health Portal - Revised ERD

## Entity Overview

The Arion Health Portal contains the following main entities:

- Supabase Auth User
- UserProfile
- Patient
- Doctor
- Staff
- DoctorAvailability
- DoctorBlockedTime
- Appointment
- MedicalRecord
- Prescription
- MedicalCertificate

---

# Authentication Structure

Supabase Auth will handle user credentials for portal accounts when authentication is implemented. Passwords, including password hashes, must not be stored in UserProfile, Patient, Doctor, or Staff. Guest/walk-in Patient records do not require an auth.users entry or a UserProfile.

```text
auth.users
    │
    │ 1:1
    ▼
UserProfile
```

`UserProfile` stores application identity, role, common contact information, and account status, not authentication credentials.

A UserProfile may correspond to one role-specific profile. Doctor and Staff use `UserProfile.id` as their primary key and foreign key. Patient has its own UUID primary key (default `gen_random_uuid()`) and a nullable, unique `user_profile_id` foreign key to `UserProfile.id`.

Admin is represented by `UserProfile.role = admin`; there is no separate Admin entity.

```text
UserProfile 0..1 ─── 0..1 Patient
                via Patient.user_profile_id (nullable, unique)

UserProfile 1 ─── 0..1 Doctor
                via Doctor.id
UserProfile 1 ─── 0..1 Staff
                via Staff.id
```

Relationship:

```text
auth.users 1 ─── 1 UserProfile
```

```text
UserProfile 0..1 ─── 0..1 Patient
UserProfile 1 ─── 0..1 Doctor
UserProfile 1 ─── 0..1 Staff
```

---

# UserProfile Structure and Account Lifecycle

The UserProfile fields match `SCHEMA.md`:

| Field | Type | Notes |
|---|---|---|
| id | uuid, PK/FK | Same UUID as `auth.users.id` |
| display_name | text | User's full/display name |
| role | enum | `patient`, `doctor`, `staff`, `admin` |
| contact_number | text | Common contact number for the account holder |
| status | enum | `active`, `inactive` only |
| created_at | timestamptz | Defaults to `now()` |
| updated_at | timestamptz | Updated when profile changes |

`display_name` and `contact_number` belong in UserProfile for account holders. Patient retains its own `full_name` and `contact_number` so a walk-in can exist without an account. Account contact information does not replace Patient contact information.

Doctor and Staff must not contain username-based authentication fields. The existing optional, unique Staff `username` is a non-authentication identifier only, not a login credential. Shared account fields belong in UserProfile.

- The only MVP account statuses are `active` and `inactive`.
- Use deactivation instead of hard deletion. Inactive accounts must not be allowed to log in or retain application access based solely on their preserved role/profile links.
- Admin can deactivate/reactivate Doctor accounts, Staff accounts, and Patient portal access. Reactivation sets the existing UserProfile status to `active`.
- Deactivation preserves UserProfile and related Patient, Doctor, and Staff records, along with Appointment, MedicalRecord, Prescription, and MedicalCertificate history and relationships. Account lifecycle must not cascade-delete them, and Admin must not delete historical clinical data.
- Reactivating or relinking a returning Patient's account access keeps the same `Patient.id`. Verify identity and reuse the existing Patient, updating `user_profile_id` when needed; do not create a second medical-history identity.

These rules describe future implementation requirements only. This cleanup does not implement authentication or connect Supabase.

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

- Staff may use basic Patient and Appointment information for calendar, appointment confirmation/cancellation, patient search, walk-in registration, same-day Appointment creation, check-in, queue management, and approved operational status updates.
- When operationally necessary, Staff may read only patient name, encounter date, attending Doctor, and a short diagnosis summary from the related MedicalRecord.
- Staff must not see detailed doctor notes, full Prescription details, MedicalCertificate contents, or sensitive clinical narrative beyond the short diagnosis summary.
- Staff cannot create, edit, or delete MedicalRecords; create or edit Prescriptions; issue, edit, or delete MedicalCertificates; modify Doctor clinical decisions; edit Patient clinical history; or manage Doctor, Staff, or Admin accounts.
- Future backend authorization and RLS must enforce this boundary. UI visibility alone is not authorization.

This permission note changes no entity relationship or schema field. The short diagnosis summary is a limited projection of existing diagnosis data, not a new field.

## Queue and check-in behavior

The waiting queue is derived from Appointment and Patient data; this cleanup adds no queue entity or fields.

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

---

# Doctor Structure

The Doctor fields match `SCHEMA.md`:

| Field | Type | Notes |
|---|---|---|
| id | uuid, PK/FK | References `UserProfile.id` |
| specialty | text | Doctor specialty |
| license_number | text | Doctor license number; later displayed on issued medical certificates |
| ptr_number | text | Doctor PTR number; later displayed on issued medical certificates |
| signature_path | text | Reference to the doctor's securely stored signature image; not image binary |

Doctor contains only these five fields. Display name, contact number, and account status come from `UserProfile.display_name`, `UserProfile.contact_number`, and `UserProfile.status` through the existing shared ID relationship. They are not duplicated in Doctor. Doctor has no password or username fields.

The actual signature image will later be stored securely, such as in Supabase Storage; Doctor stores only `signature_path`, never the image binary. License and PTR numbers will later appear on issued medical certificates. Saved medical records and issued medical certificates remain read-only.

Doctors manage their own availability and blocked time through the existing `/doctor/schedule` workflow under the scheduling rules below. This cleanup adds no routes and implements no scheduling UI, storage, or certificate rendering.

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

Represents the doctor's regular recurring weekly working schedule, managed by that doctor. Examples are Monday 09:00-17:00 and Tuesday 09:00-13:00, provided these fall within clinic operating hours.

| Field | Type | Notes |
|---|---|---|
| id | uuid, PK | Defaults to `gen_random_uuid()` |
| doctor_id | uuid, FK | References `Doctor.id` |
| day_of_week | smallint | Day number such as 0-6 |
| start_time | time | Start of available period |
| end_time | time | End of available period |
| is_active | boolean | Allows the availability slot to be disabled |

A doctor may define multiple availability periods.

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

# Doctor Blocked Time

Represents one-time exceptions to the regular schedule. A block can cover a whole day or part of a day, such as leave, a meeting, a conference, clinic closure, or personal unavailability.

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
- A doctor may publish availability up to 30 days ahead and is not required to publish all 30 days. Patients may see and book only dates/times actually published by the doctor; a recurring weekly row alone does not publish every matching future date.
- Availability must remain within clinic operating hours. The full 30-minute slot must fit within published working hours.
- DoctorBlockedTime overrides regular DoctorAvailability. Any slot overlapping blocked time is unavailable, including when only part of a day is blocked.
- Already-booked slots are unavailable for new booking. The same doctor must not have two active appointments in the same time slot or overlapping appointment intervals. Different doctors may have appointments at the same time.

Bookable slot logic: Published DoctorAvailability within the patient's next 14 days - DoctorBlockedTime - already-booked appointment slots = available 30-minute patient booking slots.

### Unresolved implementation details

The approved DoctorAvailability fields describe weekly recurrence but do not record which specific dates have actually been published or the publication horizon. `is_active` enables/disables a weekly period; it must not be treated as proof that all dates in the next 30 days were published. A publication representation needs approval before backend implementation; no additional fields or entities are introduced here. Clinic operating-hour values are also not yet specified and must be established before enforcing that boundary.

The approved patient booking window is up to 14 days ahead, replacing the earlier 60-day mock window and the prior wording that used the doctor publication limit as the patient limit. The doctor publication limit stays at 30 days. This documentation cleanup does not modify the current mock implementation.

### Patient appointment booking rules

Patient booking is limited to up to 14 days ahead. Doctor publication remains up to 30 days ahead; doctors need not publish all 30 days. Publication beyond the patient window does not make those dates bookable by patients yet.

A patient slot is bookable only when all conditions hold:

1. The date is within the next 14 days.
2. The selected doctor has actually published availability for that date/time.
3. The full 30-minute slot falls within that published availability and clinic operating hours.
4. The slot does not overlap DoctorBlockedTime.
5. No other active appointment occupies that doctor's slot.

The same doctor must not have two active appointments in the same 30-minute slot. Different doctors may have appointments at the same time.

### Fixed MVP visit types

- General Consultation
- Follow-up
- Check-up

These are the only approved fixed MVP visit types. Do not create a Service or Department table. The current Appointment field list has no dedicated visit-type field; its storage representation remains to be approved before backend implementation. Do not conflate visit type with the free-text reason for visit or invent a new field in this cleanup.

### Normal walk-in appointment flow

Staff selects an existing Patient or registers a new walk-in Patient, creates a same-day Appointment, and checks the patient in. The patient enters the queue and the doctor consults through the normal appointment flow. MedicalRecord normally links to that Appointment through appointment_id. A portal account is not required. Nullable appointment_id remains for exceptional/manual records, not the normal walk-in flow.


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

# Medical Record and Medical Certificate

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

---

# Complete Relationship Summary

The Patient branch below is optional in both directions: a Patient can exist independently with `user_profile_id = null`, and a UserProfile can have zero or one linked Patient. Doctor and Staff retain their required UserProfile link. The auth.users/UserProfile 1:1 relationship describes provisioned portal accounts.

```text
auth.users
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

Doctor also has a one-to-many relationship with DoctorBlockedTime for one-time schedule exceptions. Blocked intervals override recurring availability; they do not replace or delete Appointment history.

`Patient*` links through nullable, unique `Patient.user_profile_id`; its own `id` is independent of UserProfile. Admin remains a UserProfile role only.

---

# Relationship List

```text
auth.users 1 -> 1 UserProfile

UserProfile 0..1 -> 0..1 Patient (via nullable, unique Patient.user_profile_id)
UserProfile 1 -> 0..1 Doctor
UserProfile 1 -> 0..1 Staff

Patient 1 -> many Appointment
Doctor 1 -> many Appointment

Doctor 1 -> many DoctorAvailability
Doctor 1 -> many DoctorBlockedTime

Patient 1 -> many MedicalRecord
Doctor 1 -> many MedicalRecord

Appointment 1 -> 0..1 MedicalRecord

MedicalRecord 1 -> many Prescription

MedicalRecord 1 -> zero-or-many MedicalCertificate

Patient 1 -> many MedicalCertificate
Doctor 1 -> many MedicalCertificate
```

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
