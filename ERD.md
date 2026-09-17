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

Supabase Auth handles user credentials for portal accounts. Guest/walk-in Patient records do not require an auth.users entry or a UserProfile.

```text
auth.users
    │
    │ 1:1
    ▼
UserProfile
```

`UserProfile` stores the application role and common profile information.

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
