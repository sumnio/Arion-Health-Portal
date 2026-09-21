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

## Patient identity and portal account linking

- Patient stores `full_name`, `dob`, `sex`, `contact_number`, optional `address`, `allergies`, and `is_pwd` independently of a portal account.
- Emergency contact information uses three optional fields: `emergency_contact_name`, `emergency_contact_number`, and `emergency_contact_relationship`.
- Senior status is derived from `dob`; do not store `is_senior` or allow manual selection.
- Staff may register walk-in patients without portal accounts. These patients have their own `Patient.id` and `user_profile_id = null`.
- If a returning walk-in later receives a portal account, an authorized process verifies their identity and links the new patient-role UserProfile through `Patient.user_profile_id`. Keep the existing `Patient.id` rather than creating a replacement Patient.
- Existing appointments, medical records, and certificates remain linked to the same Patient through `patient_id`.

