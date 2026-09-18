# Milestone 1 documentation review

Reviewed every root Markdown document and all 23 images in `wireframe/` before implementation. The repository initially contained only these documents/images and a clean Git working tree.

## Source locations

The requested `AGENTS.md`, `docs/*.md`, and `docs/wireframes/` do not exist. The corresponding existing sources are `AGENT.md`, root-level Markdown files, and `wireframe/`. AGENT.md itself points to the missing docs paths. Existing sources were followed without moving or altering them.

## Conflicts and scope decisions

- Wireframes contain unapproved doctor list/profile pages; staff clinical/profile pages; admin departments, patients, appointments, settings; public services/about/contact/legal/help destinations. Only the 27 SITEMAP.md routes are implemented.
- Staff_Manage_Doctor.png depicts an Admin screen despite its filename. Doctor management remains Admin-only in navigation.
- Notifications, QR generation/verification, social login, password recovery, uploads, laboratory/imaging records, printing/downloads, and time blocking lack approval in PROJECT_SPEC.md/SITEMAP.md and are omitted.
- Patient addresses/photos, doctor licenses/contact/account status, staff job-role categories/contact/status, structured clinical vitals/assessment/attachments/draft records, certificate signatures/type/rest dates/number, and appointment service/duration/additional notes are not represented as fields in SCHEMA.md. No fields were added. Prescription duration is shown separately in images but has no separate schema field. Structured emergency-contact inputs also exceed the schema's single text field.
- Wireframes use appointment/queue statuses including Upcoming, In Progress, Waiting, With Doctor, Consulting, Scheduled, and Done, outside the appointment enum. Checked In may be derived from check_in_at, but no additional status model is approved. Certificate Valid is not the draft/issued enum. No new enums or workflows were implemented.
- Staff_NewPatient.png permits manual senior and Senior/PWD appointment priority selection, and a pregnancy flag; the schema derives senior status from DOB, derives senior/PWD queue priority from Patient, and allows only normal/urgent appointment priority. Example queue order also differs from the urgent, senior/PWD, normal ordering required by SCHEMA.md.
- Booking artwork promises immediate confirmation while other images show pending requests. The written documents do not define the initial booking/approval transition; deferred with all booking behavior.
- MedicalRecord diagnosis is labeled optional in a wireframe but is not marked nullable in the schema. No clinical forms were built.
- Staff_NewPatient.png shows patient draft saving and account registration shortcuts not defined in the approved workflow. No such actions were added.

## Written-document gaps for future milestones

- Guest Patient records may have no UserProfile, but only UserProfile has display_name. Guest names currently have no approved storage field. This is a schema item to resolve before Supabase integration; do not change the schema yet.
- The original walk-in ambiguity is resolved by the project decisions below: normal MVP walk-ins create a same-day Appointment, and the MedicalRecord links to that appointment. Existing SCHEMA.md/ERD.md prose describing appointment-free walk-in records should be read in light of this explicit decision; those files have not been changed.
- ERD recommends at most one MedicalRecord per Appointment; SCHEMA.md makes the uniqueness constraint conditional. Optional appointment/certificate references are explained in prose, although compact relationship diagrams do not consistently display optionality on both sides.
- Appointment overlap prevention is required, but no duration/end time or fixed slot length is specified.
- DoctorAvailability exists in schema/ERD, but editing permissions and time-block exceptions are not specified in the core MVP or sitemap.

These gaps do not block route placeholders. No schema, role, route, or workflow decisions were invented to resolve them.

## Approved project decisions before Milestone 2

User decisions recorded on September 17, 2026. Apply these going forward; this update does not start Milestone 2.

### Branding

- The application name is **Arion Health Portal**, consistently across all layouts.
- Do not use **Arion Clinic** as the application name.
- Use **Arion Health Clinic** only where clinic/facility information is needed.

### Documentation precedence and wireframe scope

- PROJECT_SPEC.md, SITEMAP.md, SCHEMA.md, and ERD.md take priority over wireframes.
- Wireframes are visual/layout references only.
- Do not implement features shown only in wireframes, including social login, QR verification, external record uploads, analytics, laboratory/imaging modules, advanced settings, or routes not approved in SITEMAP.md.

### Normal MVP walk-in workflow

```text
Patient selected/registered by staff
  -> Same-day appointment created
  -> Check-in
  -> Queue
  -> Doctor consultation
  -> Medical record linked to that appointment
```

Keep nullable MedicalRecord.appointment_id for exceptional/manual records only, not the normal MVP walk-in workflow. This clarifies workflow without changing the database schema.

### Data and milestone boundaries

- Do not change the database schema yet.
- Resolve the guest patient name storage issue before Supabase integration.
- Continue using mock data for frontend milestones; do not connect Supabase yet.
- No detailed UI is authorized by this decision update.

## Visual interpretation

Images alternate blue Arion Health Portal and green Arion Clinic branding, with inconsistent logos, dates, clinic locations, and sidebar menus. Shells preserve header, left sidebar, pale content background, bordered white content panel, and active navigation. Portal naming is consistent; Patient/Staff use blue accents and Doctor/Admin green. Missing dedicated wireframes for unauthorized, staff patient list, and existing-patient walk-in pages use the same minimal placeholder structure.

## Implementation boundary

Only navigation and placeholders are functional. Login provides explicitly labeled mock role-preview links; it is not authentication or role enforcement. Unknown URLs show a fallback without introducing another approved feature route. Backend SDKs, real patient data, detailed forms, dashboards, queue logic, and persistence are absent.
