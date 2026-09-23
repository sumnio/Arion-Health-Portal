# Arion Health Portal - Revised Database Schema

This schema is designed for the Arion Health Portal MVP using Supabase/PostgreSQL.

Main revisions:
- UUID primary keys
- Supabase Auth handles passwords/authentication
- `Appointment` replaces `Schedule`
- `MedicalRecord` replaces generic `Records`
- Doctor availability is normalized
- Prescriptions use their own table
- Appointment date/time uses timestamps
- Queue/check-in support is included
- Created/updated timestamps are included

---

# 1. Authentication and User Profiles

Authentication credentials will be handled by Supabase Auth when authentication is implemented.

Passwords, including password hashes, must not be stored in UserProfile, Patient, Doctor, or Staff. UserProfile stores application identity, role, common contact information, and account status, not authentication credentials. Doctor and Staff must not contain username-based authentication fields.

Portal accounts have a UserProfile linked to `auth.users.id`. Patient records are independent and only link to a UserProfile when the patient has a portal account. Doctor and Staff retain their shared primary-key relationship with UserProfile.

Admin is represented by `UserProfile.role = admin`; there is no separate Admin entity.

## UserProfile

| Field | Type | Notes |
|---|---|---|
| id | uuid, PK/FK | Same UUID as `auth.users.id` |
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
- These are documentation requirements for future implementation; authentication and account lifecycle enforcement are not implemented by this cleanup.

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

A Patient can exist without a UserProfile or Supabase Auth account. Staff can register a guest/walk-in patient with `user_profile_id = null`.

`full_name` belongs to Patient so a walk-in's name does not depend on a UserProfile. `contact_number`, optional `address`, and the three optional emergency contact fields also belong to Patient. The separate emergency contact fields replace the former single `emergency_contact` field.

For a registered patient, `user_profile_id` links to a UserProfile with the `patient` role. Each Patient has at most one linked UserProfile, and each UserProfile can link to at most one Patient. Multiple guest patients can have a null `user_profile_id`.

If a returning walk-in later receives a portal account, an authorized process can verify the patient's identity and set the existing `Patient.user_profile_id` to the new patient-role `UserProfile.id`. Do not create a replacement Patient or change `Patient.id`. Existing Appointment, MedicalRecord, and MedicalCertificate relationships continue to reference the same Patient through `patient_id`.

### Derived values

Senior status must be calculated from `dob`; do not add a stored `is_senior` field or allow manual selection. `is_pwd` remains stored in Patient.

---

## Doctor

| Field | Type | Notes |
|---|---|---|
| id | uuid, PK/FK | References `UserProfile.id` |
| specialty | text | Doctor specialty |
| license_number | text | Doctor license number; later displayed on issued medical certificates |
| ptr_number | text | Doctor PTR number; later displayed on issued medical certificates |
| signature_path | text | Reference to the doctor's securely stored signature image; not image binary |

Doctor contains only the five fields above. `display_name`, `contact_number`, and account `status` come from the linked UserProfile through `Doctor.id = UserProfile.id`; do not duplicate them in Doctor. Doctor has no password or username fields.

The signature image will later be stored securely, such as in Supabase Storage. `signature_path` stores only its reference; the actual image binary must not be stored in Doctor. This cleanup does not implement storage or certificate rendering.

Doctors manage their own availability through the existing `/doctor/schedule` workflow under the scheduling rules below. Saved medical records and issued medical certificates remain read-only; these profile fields do not authorize editing historical clinical documents.

---

## Staff

| Field | Type | Notes |
|---|---|---|
| id | uuid, PK/FK | References `UserProfile.id` |
| username | text, unique, nullable | Existing optional staff identifier only; not a login credential or authentication field |

Authentication will remain in Supabase Auth. The optional Staff username does not enable username-based authentication; do not add authentication fields to Doctor or Staff. Shared display name, contact number, role, and account status belong in UserProfile.

---

# 2. Scheduling

## DoctorAvailability

Represents the doctor's regular recurring weekly working schedule, managed by that doctor. Examples are Monday 09:00-17:00 and Tuesday 09:00-13:00, provided these fall within clinic operating hours.

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

## DoctorBlockedTime

Represents one-time exceptions to the regular schedule. A block can cover a whole day or part of a day, such as leave, a meeting, a conference, clinic closure, or personal unavailability.

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
| reason | text | Reason for visit |
| priority | enum | `normal`, `urgent` |
| created_by | uuid, nullable | User who created appointment |
| created_at | timestamptz | Defaults to `now()` |
| updated_at | timestamptz | Updated when changed |

### Queue priority

Queue ordering should follow:

1. Urgent
2. Senior citizen / PWD
3. Normal

Patients in the same priority tier should be ordered using:

1. `check_in_at`, if available
2. otherwise `appointment_at`

Senior/PWD priority is derived from the Patient record rather than manually stored in the Appointment.

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
| patient_id | uuid, FK | References `Patient.id` |
| doctor_id | uuid, FK | References `Doctor.id`; certificate signer |
| medical_record_id | uuid, FK, nullable | References `MedicalRecord.id` |
| date_issued | date, nullable | Null while draft |
| purpose | text | Example: Fit to Work, Sick Leave |
| diagnosis_summary | text | Patient-facing summary |
| valid_until | date, nullable | Optional expiration date |
| status | enum | `draft`, `issued` |
| created_at | timestamptz | Defaults to `now()` |
| updated_at | timestamptz | Updated when changed |

A single MedicalRecord may produce multiple certificates if necessary.

Example:

```text
MedicalRecord
├── Fit-to-Work Certificate
└── Sick Leave Certificate
```

If the final project requires only one certificate per medical record, a unique constraint can later be placed on `medical_record_id`.

---

# 5. Recommended Constraints

## Authentication

`UserProfile.id` should reference:

```text
auth.users.id
```

Account lifecycle uses deactivation, not deletion of the Auth user or UserProfile. Do not configure account deletion to cascade into application profiles or history. Preserve related Patient, Doctor, Staff, Appointment, MedicalRecord, Prescription, and MedicalCertificate records and references. The former cascade-delete recommendation is superseded by these history-preservation requirements.

---

## Patient account link

`Patient.id` is its own UUID primary key, not a foreign key to UserProfile.

`Patient.user_profile_id` is a nullable foreign key to `UserProfile.id` with a unique constraint on non-null values. This allows multiple guest/walk-in patients without accounts while preventing one account from linking to multiple Patient records.

## Appointment conflicts

Prevent the same doctor from having overlapping active appointments.

For the MVP, use one patient per doctor per 30-minute appointment slot. Already-booked slots cannot be booked again for that doctor; different doctors may use the same time slot. Published availability and blocked-time checks must also pass.

---

## Medical record per appointment

If one appointment should only produce one MedicalRecord:

```text
UNIQUE(appointment_id)
```

when `appointment_id` is not null.

Exceptional/manual records outside the normal appointment flow may have:

```text
appointment_id = null
```

---

## Enums

Use PostgreSQL enums or CHECK constraints for:

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

through application logic or a PostgreSQL trigger.

---

# 6. Security / Supabase RLS

Use Supabase Row Level Security.

General intended permissions:

Account-based access requires an active UserProfile in addition to the role and ownership rules below. Inactive accounts must not be allowed to log in or retain application access merely because their historical profile and role links remain intact.

## Patient

Portal ownership is determined by `Patient.user_profile_id = auth.uid()`, not by comparing `Patient.id` to the authentication UUID. Related appointments, records, and certificates are matched through their `patient_id` to that Patient. A null account link grants no patient portal access; staff and doctor access remains governed by their role permissions.

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

Doctors manage their own recurring availability and blocked time through the existing `/doctor/schedule` workflow under the scheduling rules above. Saved medical records and issued medical certificates are read-only.

## Staff

Can access operational information such as:
- appointments
- queue
- check-in
- walk-in registration

Staff should not have unnecessary clinical editing permissions.

## Admin

Can manage:
- doctor accounts
- staff accounts
- role/account administration

Admin can deactivate/reactivate Doctor accounts, Staff accounts, and Patient portal access through UserProfile status. This does not grant permission to delete historical clinical data. Deactivation preserves the related profiles and all appointment, medical record, prescription, and certificate history.

---

# 7. Backend Portability

Do not call Supabase directly throughout React components.

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

Current architecture:

```text
React
  ↓
Service Layer
  ↓
Supabase
```

Possible future architecture:

```text
React
  ↓
Service Layer
  ↓
Express API
  ↓
MongoDB
```

This makes a future migration away from Supabase easier.
