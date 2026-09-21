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
