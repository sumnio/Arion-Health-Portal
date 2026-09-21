# Arion Health Portal

## Purpose
Arion Health Portal is a clinic management and patient portal system.

## Roles
- Patient
- Doctor
- Staff
- Admin

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
- Issue medical certificates

### Staff
- Manage appointments
- Check in patients
- Manage queue
- Register walk-in patients

### Admin
- Manage doctors
- Manage staff
- Deactivate/reactivate Doctor accounts, Staff accounts, and Patient portal access; never delete historical clinical data

## Doctor profile and clinical document rules

- Doctor contains `id`, `specialty`, `license_number`, `ptr_number`, and `signature_path` only.
- Doctor display name, contact number, and account status come from the linked UserProfile. Do not duplicate them in Doctor or add password/username fields.
- Doctor license and PTR numbers will later be displayed on issued medical certificates.
- `signature_path` references the doctor's signature image, which will later be stored securely, such as in Supabase Storage. Do not store image binary in Doctor.
- Saved medical records and issued medical certificates remain read-only.
- Doctors manage their own availability and blocked time under the scheduling rules below. This cleanup adds no routes and implements no scheduling UI, signature storage, or certificate rendering.

## Doctor scheduling

DoctorAvailability stores `id`, `doctor_id`, `day_of_week`, `start_time`, `end_time`, and `is_active` for recurring weekly hours. DoctorBlockedTime stores `id`, `doctor_id`, `start_at`, `end_at`, and `reason` for one-time whole-day or partial-day exceptions such as leave, meetings, conferences, clinic closure, or personal unavailability.

### Scheduling and publication rules

- Appointment slots are fixed at 30 minutes.
- Doctors manage their own recurring availability and blocked time within the existing `/doctor/schedule` workflow; no separate availability route is added.
- A doctor may publish availability up to 30 days ahead and is not required to publish all 30 days. Patients may see and book only dates/times actually published by the doctor; a recurring weekly row alone does not publish every matching future date.
- Availability must remain within clinic operating hours. The full 30-minute slot must fit within published working hours.
- DoctorBlockedTime overrides regular DoctorAvailability. Any slot overlapping blocked time is unavailable, including when only part of a day is blocked.
- Already-booked slots are unavailable for new booking. The same doctor must not have two active appointments in the same time slot or overlapping appointment intervals. Different doctors may have appointments at the same time.

Bookable slot logic: Published DoctorAvailability - DoctorBlockedTime - already-booked appointment slots = available 30-minute patient booking slots.

### Unresolved implementation details

The approved DoctorAvailability fields describe weekly recurrence but do not record which specific dates have actually been published or the publication horizon. `is_active` enables/disables a weekly period; it must not be treated as proof that all dates in the next 30 days were published. A publication representation needs approval before backend implementation; no additional fields or entities are introduced here. Clinic operating-hour values are also not yet specified and must be established before enforcing that boundary.

These approved rules supersede the earlier 60-day mock booking window: patient booking is limited to actually published availability within the doctor's 30-day publication limit. This documentation cleanup does not modify the current mock implementation.

## Shared profile and account lifecycle

- UserProfile contains `id`, `display_name`, `role`, `contact_number`, `status`, `created_at`, and `updated_at`.
- Roles are limited to `patient`, `doctor`, `staff`, and `admin`. Account statuses are limited to `active` and `inactive`.
- Use deactivation instead of hard deletion. Inactive accounts must not be allowed to log in or retain application access. Admin may later reactivate the same account.
- Deactivation preserves UserProfile and related Patient, Doctor, and Staff records. Historical appointments, medical records, prescriptions, certificates, and their relationships remain intact; account lifecycle must not cascade-delete them.
- Reactivating or relinking account access for a returning Patient must reuse the existing `Patient.id`; do not create a second medical-history identity.
- For account holders, shared display name and contact number belong in UserProfile. Keep `Patient.contact_number` in Patient for walk-ins without accounts.
- Passwords, including password hashes, must not be stored in UserProfile, Patient, Doctor, or Staff. Supabase Auth will handle authentication credentials later. Do not add username-based authentication fields to Doctor or Staff; the existing optional Staff username is a non-authentication identifier only.
- This documentation cleanup does not implement authentication, account actions, or new routes.

## Patient identity and portal account linking

- Patient stores `full_name`, `dob`, `sex`, `contact_number`, optional `address`, `allergies`, and `is_pwd` independently of a portal account.
- Emergency contact information uses three optional fields: `emergency_contact_name`, `emergency_contact_number`, and `emergency_contact_relationship`.
- Senior status is derived from `dob`; do not store `is_senior` or allow manual selection.
- Staff may register walk-in patients without portal accounts. These patients have their own `Patient.id` and `user_profile_id = null`.
- If a returning walk-in later receives a portal account, an authorized process verifies their identity and links the new patient-role UserProfile through `Patient.user_profile_id`. Keep the existing `Patient.id` rather than creating a replacement Patient.
- Existing appointments, medical records, and certificates remain linked to the same Patient through `patient_id`.
