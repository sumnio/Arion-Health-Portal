# Arion Health Portal - Revised ERD

## Entity Overview

The Arion Health Portal contains the following main entities:

- Supabase Auth User
- UserProfile
- Patient
- Doctor
- Staff
- DoctorAvailability
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

A MedicalRecord may also exist without an Appointment.

This supports walk-in patients:

```text
Walk-in
   ↓
MedicalRecord
appointment_id = null
```

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

A walk-in does not require an existing scheduled appointment or a portal account. Staff can create a guest Patient with its own UUID and `user_profile_id = null`, without creating a UserProfile or Supabase Auth account. An existing registered patient can also attend as a walk-in and retain their account link.

```text
Patient
   ↓
Staff registers walk-in (account optional)
   ↓
Queue / Check-in
   ↓
Doctor consultation
   ↓
MedicalRecord
```

In this case:

```text
MedicalRecord.appointment_id = null
```

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
