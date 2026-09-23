PUBLIC
/
/login
/register
/unauthorized

Authentication notes:
- `/login` is shared by Patient, Doctor, Staff, and Admin. Real login uses account credentials and does not ask the user to select a role.
- `/register` is Patient self-registration only. Doctor and Staff accounts are Admin-provisioned; the Admin account is provisioned separately.
- Unauthenticated access to any protected route redirects to `/login`.
- An authenticated user with the wrong role is sent to `/unauthorized` or denied access.
- Inactive accounts do not receive normal portal access.
- The current mock role selector and “Exit mock preview” controls are temporary development aids and must be removed when production authentication is implemented.

PATIENT
/patient/dashboard
/patient/profile
/patient/book
/patient/appointments
/patient/appointments/:id
/patient/records
/patient/records/:id
/patient/certificates
/patient/certificates/:id

DOCTOR
/doctor/dashboard
/doctor/schedule
/doctor/patients/:id
/doctor/patients/:id/add-record
/doctor/records/:id/certificate/new

STAFF
/staff/dashboard
/staff/calendar
/staff/queue
/staff/patients
/staff/patients/new
/staff/patients/:id/walk-in

ADMIN
/admin/dashboard
/admin/patients
/admin/doctors
/admin/staff

Protected route groups:
- `/patient/*` requires an authenticated, active UserProfile with role `patient`.
- `/doctor/*` requires an authenticated, active UserProfile with role `doctor`.
- `/staff/*` requires an authenticated, active UserProfile with role `staff`.
- `/admin/*` requires an authenticated, active UserProfile with role `admin`.

Post-login navigation:
- `patient` -> `/patient/dashboard`
- `doctor` -> `/doctor/dashboard`
- `staff` -> `/staff/dashboard`
- `admin` -> `/admin/dashboard`

These redirects are navigation only. Route guards and future backend authorization plus database access controls must independently enforce authentication, active status, ownership, and role permissions. Supabase RLS is one possible enforcement mechanism when that provider is selected.

