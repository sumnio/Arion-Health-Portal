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

Authentication credentials are handled by Supabase Auth.

The application does not store plaintext passwords in Patient, Doctor, or Staff tables.

Portal accounts have a UserProfile linked to `auth.users.id`. Patient records are independent and only link to a UserProfile when the patient has a portal account. Doctor and Staff retain their shared primary-key relationship with UserProfile.

Admin is represented by `UserProfile.role = admin`; there is no separate Admin entity.

## UserProfile

| Field | Type | Notes |
|---|---|---|
| id | uuid, PK/FK | Same UUID as `auth.users.id` |
| role | enum | `patient`, `doctor`, `staff`, `admin` |
| display_name | text | User's full/display name |
| created_at | timestamptz | Defaults to `now()` |
| updated_at | timestamptz | Updated when profile changes |

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

---

## Staff

| Field | Type | Notes |
|---|---|---|
| id | uuid, PK/FK | References `UserProfile.id` |
| username | text, unique, nullable | Optional staff-specific username |

Authentication still remains in Supabase Auth.

---

# 2. Scheduling

## DoctorAvailability

Stores the doctor's recurring available hours.

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
| appointment_id | uuid, FK, nullable | References `Appointment.id`; null for walk-ins |
| encounter_at | timestamptz | Consultation/record date and time |
| diagnosis | text | Clinical diagnosis |
| notes | text, nullable | Doctor's notes |
| follow_up | text, nullable | Follow-up recommendation |
| created_at | timestamptz | Defaults to `now()` |
| updated_at | timestamptz | Updated when changed |

A medical record can exist without a scheduled appointment.

Example:

```text
Walk-in patient
    ↓
MedicalRecord

appointment_id = null
```

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

Recommended behavior:

```text
ON DELETE CASCADE
```

---

## Patient account link

`Patient.id` is its own UUID primary key, not a foreign key to UserProfile.

`Patient.user_profile_id` is a nullable foreign key to `UserProfile.id` with a unique constraint on non-null values. This allows multiple guest/walk-in patients without accounts while preventing one account from linking to multiple Patient records.

## Appointment conflicts

Prevent the same doctor from having overlapping active appointments.

For the MVP, use one patient per doctor per appointment slot.

---

## Medical record per appointment

If one appointment should only produce one MedicalRecord:

```text
UNIQUE(appointment_id)
```

when `appointment_id` is not null.

Walk-in records may have:

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
