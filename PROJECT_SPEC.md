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
- View the Staff Dashboard
- View and manage the clinic calendar and appointment operations
- Search existing patients and register walk-in patients
- Create same-day walk-in appointments
- Check in patients and manage the queue

## Staff permissions

Staff access follows least-privilege principles and is limited to clinic operations plus the approved limited medical-record summary.

### Operational access

Staff may:

- view the Staff Dashboard;
- view and manage the clinic calendar;
- view operational appointment details;
- confirm eligible appointments;
- cancel eligible appointments when appropriate;
- search existing patients;
- view basic patient information needed for appointment, walk-in, check-in, and queue workflows;
- register walk-in patients and create their same-day Appointments;
- check in eligible patients and manage the queue; and
- mark appropriate operational Appointment states, including no-show or completed where the approved workflow allows it.

These permissions must continue to follow the approved Appointment and queue rules. Staff pages must not be used to edit clinical history.

### Limited read-only medical-record visibility

When operationally necessary, Staff may view only:

- patient name;
- encounter date;
- attending doctor; and
- short diagnosis summary.

Staff must not view detailed doctor notes, full prescription details, MedicalCertificate contents, or sensitive clinical narrative beyond the approved short diagnosis summary. More detailed clinical information remains Doctor-only.

### Prohibited actions

Staff must not create, edit, or delete MedicalRecords; create or edit Prescriptions; issue, edit, or delete MedicalCertificates; modify Doctor clinical decisions; edit patient clinical history; or manage Doctor, Staff, or Admin accounts.

These restrictions must later be enforced by backend authorization and Supabase RLS or an equivalent service-layer policy. Hiding UI controls is not sufficient. This cleanup does not implement authorization, connect Supabase, add routes, or change application behavior.

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

## Queue and check-in rules

Queue priority is:

1. Urgent
2. Senior / PWD
3. Normal

- Senior and PWD share one tier. A patient who is both Senior and PWD receives no double priority.
- Senior status is derived from `Patient.dob`; do not store or manually assign `is_senior`. PWD status comes from `Patient.is_pwd`.
- Pregnancy does not require a separate queue priority or status. A case that qualifies as urgent under clinic policy uses the existing urgent Appointment priority; otherwise the standard derived tier applies.
- Appointment priority values remain only `normal` and `urgent`. Senior/PWD is derived for queue ordering and is not a new stored Appointment priority.
- Within the same tier, earlier `check_in_at` goes first. If a fallback is needed because `check_in_at` is unavailable, use `appointment_at` consistently. Do not order the queue by Appointment creation time.
- Only eligible Appointments may be checked in. `pending` and `confirmed` may be eligible; `cancelled`, `completed`, and `no_show` are not eligible for normal check-in.
- Check-in sets `check_in_at` and adds the patient to the waiting queue. A non-null `check_in_at` prevents duplicate check-in and must not be overwritten by a repeated normal check-in.
- Walk-ins use the same logic after staff creates their same-day Appointment and checks them in: Urgent -> Senior/PWD -> Normal, then earlier check-in first within the tier.
- This cleanup introduces no queue entity, fields, priority values, routes, or application behavior.


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
