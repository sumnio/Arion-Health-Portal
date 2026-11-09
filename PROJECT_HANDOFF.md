# Arion Health Portal MVP Handoff

## v1.2.20 handoff — final UI and accessibility gate

The final v1.2 frontend pass found no role-navigation, responsive-layout, or workflow regression. Small accessibility fixes complete keyboard focus trapping, Escape handling, background scroll locking, and trigger-focus restoration for prescription and supporting-document previews. Notification clearing now focuses the safe cancellation action and restores the originating control. Representative Public/Auth, Patient, Doctor, Staff, and Admin pages were reviewed at mobile, tablet, and desktop widths, with horizontal scrolling retained only inside the weekly operational calendar.

There are no backend, schema, API, auth/MFA, RBAC, scheduling, clinical, notification, provider, or environment changes. The existing Vite large-chunk warning remains non-blocking and no unrelated dependency or code-splitting work was introduced. No deployment was performed.

## v1.2.19 handoff — role-by-role surgical UI polish

The remaining visual outliers now follow the v1.2.18 shared standard. Analytics cards and tables, Doctor Patient and record-entry pages, Staff calendar and walk-in pages, Admin account lists, notification centers, Patient Profile/PWD forms, and public authentication cards were compacted without changing their content, navigation, permissions, or workflows. Routine nested surfaces no longer rely on decorative shadows, status badges are less pill-like, and desktop/mobile layouts avoid horizontal overflow.

Already-consistent pages were intentionally preserved, especially the weekly Doctor Schedule, role dashboards, Patient clinical/certificate surfaces, Doctor certificate/history pages, Staff queue/PWD pages, landing content, and Assistant. Validation uses the isolated `arion_health_e2e` database with fake/test providers and external AI disabled. No backend, schema, API, auth/RBAC, provider, environment, or deployment change was made.

## v1.2.18 handoff — UI audit and surgical cleanup

The interface now uses a smaller shared visual system for card surfaces, borders, corner radii, spacing, focus states, controls, links, and status badges. Public, Patient, Doctor, Staff, and Admin pages keep their existing navigation and workflows, while excessive padding, gradients, oversized headings and metrics, roomy empty states, inconsistent rounding, and unnecessary shadows were reduced. Dialogs and other true overlays keep enough elevation to remain clear.

Literal copy replaces a few generic marketing phrases, and shared dashboard/booking cards reduce duplicated styling. Desktop pages were reviewed manually, while the browser suite covers responsive and 320-pixel journeys. No backend file, schema, API, permission, scheduling rule, clinical rule, provider, environment variable, or deployment was changed. Final validation passed 231 frontend tests, 669 backend tests, 108 Playwright journeys, the Production build, and whitespace checks. The Playwright run uses only `arion_health_e2e` with fake email/SMS and external AI disabled.

## v1.2.10 appointment reschedule email link

A successful eligible Patient reschedule now sends one privacy-safe email to the Patient's linked portal-account email. It shows only the updated date/time, the Doctor's display name when available, and a **View Updated Appointment** link created from `APP_BASE_URL`. The protected link requires normal login and Patient ownership; it contains no authentication token or clinical/private Patient information.

Email happens only after the atomic reschedule succeeds. Failed, stale, repeated, unauthorized, and concurrent losing requests send nothing. Missing email/account, disabled delivery, or provider failure does not undo the reschedule. The Patient sees a safe partial-success message if delivery fails. Existing in-app notification fan-out and SMS reminder invalidation, versioning, and replanning remain unchanged. Staff currently has no approved reschedule route/UI, and this milestone does not add one. No deployment was performed.

Final local validation records **651/651 backend tests**, **221/221 frontend tests**, and **104/104 Playwright browser journeys** with fake email, fake/disabled SMS, external AI disabled, and the dedicated E2E database. The Production frontend build passed with the existing non-blocking large-chunk warning. Frontend and backend dependency audits report zero known vulnerabilities, and whitespace validation passed.

## v1.2.9 returning Patient and Portal Access completion

Staff now searches returning Patients by full name, canonical phone, Patient invitation email, or linked account email. Search results show only full name, DOB, masked phone/email, Portal Access status, and optional last visit. Selecting a result reuses the same Patient record for the next walk-in appointment, preserving all prior appointments, clinical records, prescriptions, certificates, PWD verification, notifications, and account linkage.

New Patient registration runs a server-authoritative duplicate review. Phone/email matches are strong, normalized name plus DOB is possible, and name alone remains allowed. Safe candidate cards offer Use Existing Patient. Allowed matches require the explicit Continue as New Patient action; no records are auto-merged. Emails already attached to a Patient or AuthAccount are blocked from a second identity, and nullable `Patient.portal_email` is now uniquely indexed.

Patient Detail includes Send, Resend, and failure Retry controls. Before claim, Staff may correct the email; the replacement transaction invalidates older unused links. Active accounts have no invitation action and cannot change login email through this flow. Resend remains rate-limited, Staff-only, hash-only, transaction-safe, and privacy-minimized. No deployment was performed.

## v1.2.8 walk-in portal invitations

Clinic Patient records and portal accounts remain separate. A Staff-created walk-in may have no email and remain No Account, or may have an optional email and receive an invitation only after appointment creation succeeds. The Patient verifies that email by OTP and creates their own password; Staff never creates or receives credentials. Claiming links the account to the existing Patient record, so prior appointments, records, certificates, PWD verification, and other Patient-owned history remain attached.

Invitation tokens expire after 24 hours, are one-time, and are stored only as protected hashes. Resend invalidates earlier unused invitations. Email delivery is best effort and cannot roll back clinic work. Duplicate account emails, already-linked Patients, stale invitations, and concurrent claims fail closed. The invitation and OTP emails contain no clinical data. No deployment was performed. The formerly deferred returning-Patient and duplicate-review UI is completed in v1.2.9.

## Final project status

Arion Health Portal has completed MVP development, security hardening, browser regression testing, Vercel deployment, and live synthetic Production validation through Milestone 25.8. Post-MVP Milestones 1.25–1.38 add the local email/account-token foundation, Patient registration email OTP verification, Patient-only secure password recovery, the Arion Assistant v1 feature set and acceptance gate, and the complete Consultation Supporting Documents v1 Patient/Doctor workflow. None of these post-MVP milestones has been deployed.

| Layer | Final technology |
| --- | --- |
| Frontend | React + Vite + Tailwind CSS |
| Backend | Node.js + Express |
| Database | MongoDB Atlas through Mongoose |
| Hosting | Vercel Services |

| Environment | URL | Database | Status |
| --- | --- | --- | --- |
| Production | `https://arion-health-portal.vercel.app` | `arion_health_production` on the isolated `arion-health-production` Atlas resource | **DEPLOYED + RESTRICTED** |
| Preview | `https://arion-health-preview.vercel.app` | `arion_health_preview` on the isolated `arion-health-preview` Atlas resource | Protected, separate, and healthy |
| E2E | Local Playwright-managed application | Dedicated database whose name contains `e2e` | Disposable test data only |

Production `/api/health` returns HTTP 200. Production is approved only for school/demo use with synthetic data. It is not approved for real patient or clinical operations.

Milestones 13–23, 24.1–24.7, and 25.1–25.8 are complete. Any new feature work begins as post-MVP development and must preserve the restrictions below.

| Roadmap item | Status |
| --- | --- |
| Milestones 13–23 | Complete |
| Milestones 24.1–24.7 | Complete |
| Milestone 25.1 | Complete |
| Milestone 25.2 | Complete |
| Milestone 25.3 | Complete |
| Milestone 25.4 | Complete |
| Milestone 25.5 | Complete |
| Milestone 25.6 | Complete |
| Milestone 25.7 | Complete |
| Milestone 25.8 | Complete |
| MVP development | **COMPLETE** |
| MVP deployment | **COMPLETE** |
| Post-MVP Milestone 1.25 | **IMPLEMENTED LOCALLY — NOT DEPLOYED** |
| Post-MVP Milestone 1.26 | **IMPLEMENTED LOCALLY — NOT DEPLOYED** |
| Post-MVP Milestone 1.27 | **IMPLEMENTED LOCALLY — NOT DEPLOYED** |
| Post-MVP Milestone 1.28 | **IMPLEMENTED LOCALLY — NOT DEPLOYED** |
| Post-MVP Milestone 1.29 | **IMPLEMENTED LOCALLY — NOT DEPLOYED** |
| Post-MVP Milestone 1.30 | **IMPLEMENTED LOCALLY — NOT DEPLOYED** |
| Post-MVP Milestone 1.31 | **IMPLEMENTED LOCALLY — NOT DEPLOYED** |
| Post-MVP Milestone 1.32 | **IMPLEMENTED LOCALLY — NOT DEPLOYED** |
| Post-MVP Milestone 1.33 | **IMPLEMENTED LOCALLY — NOT DEPLOYED** |
| Post-MVP Milestone 1.34 | **IMPLEMENTED LOCALLY — NOT DEPLOYED** |
| Post-MVP Milestone 1.35 | **ACCEPTANCE COMPLETE LOCALLY — NOT DEPLOYED** |
| Post-MVP Milestone 1.36 | **IMPLEMENTED LOCALLY — NOT DEPLOYED** |
| Post-MVP Milestone 1.37 | **IMPLEMENTED LOCALLY — NOT DEPLOYED** |
| Post-MVP Milestone 1.38 | **IMPLEMENTED LOCALLY — NOT DEPLOYED** |

## Architecture

```text
Browser
  -> Vercel React/Vite frontend
  -> same-origin /api requests
  -> Express service through the listener-free Vercel adapter
  -> Mongoose connection reuse
  -> MongoDB Atlas
```

Vercel routes `/api/*` to Express before the React SPA fallback. React Router owns frontend deep links. `server/src/vercel.js` adapts the existing Express application to Vercel without calling `listen()`, while `server/src/server.js` remains the local server entry. Warm serverless instances reuse the cached Mongoose connection and in-flight connection promise.

Production-mode request throttling uses the shared MongoDB-backed rate-limit store so counters remain consistent across serverless instances and fail closed if the store is unavailable.

Production, Preview, development, and E2E data must remain isolated. Production and Preview use distinct Vercel environment scopes, Atlas resources, database names, authentication secrets, MFA encryption keys, and exact CORS origins.

### Post-MVP email verification and Patient password recovery

The backend contains a fixed-template transactional email service, an isolated native-fetch Resend adapter, and a silent fake provider for tests/local use. No arbitrary email-sending endpoint exists. New public Patient registrations require a six-digit email OTP before login. Existing accounts remain compatible because `AuthAccount.email_verification_required` defaults false. Verification uses a random opaque HttpOnly cookie; OTPs expire in ten minutes, allow five challenge attempts, are single-use, and are replaced on resend.

Milestone 1.26 adds `/verify-email`, registration redirect, verification status, OTP submission, resend, and unverified-Patient login enforcement. Milestone 1.27 adds `/forgot-password` and `/reset-password` for active Patients only. Forgot responses are identical for every address; reset links contain one-use 32-byte tokens derived only from `APP_BASE_URL`, are exchanged immediately for a fifteen-minute HttpOnly cookie, and are removed from the visible URL. Successful reset updates the password, revokes older authenticated JWTs through `auth_session_version`, preserves email-verification state, and never auto-authenticates. Staff, Doctor, Admin, inactive-account handling, and Admin MFA are unchanged. Production/Preview environment variables, databases, and deployments were not modified. Before deployment, configure and validate `EMAIL_PROVIDER=resend`, an approved sender/domain, provider credentials, `APP_BASE_URL`, and the separate account-token secret in the correct isolated environment.

### Post-MVP Arion Assistant privacy foundation

Milestone 1.28 adds the backend-only `POST /api/patient/assistant/message` foundation for authenticated active Patients. It is text-only, stateless, read-only, and fully internal: a conservative deterministic privacy gateway routes a small set of portal, account, and appointment-help intents; health/clinical and emergency-sensitive text receives fixed safety responses; ambiguous and injection-style requests fail closed. Personalized appointment questions do not query live data and instead direct the Patient to My Appointments. There is no Gemini, Ollama, hosted provider, Patient-data tool, chatbot UI, or chat-history storage. Raw messages and replies are not logged. The dedicated limit is 10 requests per minute per authenticated Patient through the existing shared limiter infrastructure. No deployment or Production/Preview configuration changed.

Milestone 1.29 adds one centralized code-owned knowledge base with Patient-friendly deterministic answers for booking, appointment statuses, rescheduling, cancellation, arrival, queue order, no-show, records, certificates, notifications, email verification, Patient password reset, Profile behavior and privacy, Philippine mobile format, and assistant capabilities. It also keeps an internal suggested-question list for later UI work without exposing another endpoint. Health/clinical/emergency classification and unsafe-request handling run before FAQ matching. Live Patient appointment, Doctor, status, and notification questions still direct the Patient to the appropriate portal page without repository access. The existing endpoint, Patient-only authorization, safe category-only logging, 800-character input limit, and 10-per-minute per-Patient rate limit are unchanged. No provider, outbound AI request, database collection, schema relationship, transcript, UI, dependency, environment configuration, or deployment was added.

Milestone 1.30 adds internal read-only tools for the authenticated Patient's next/upcoming appointments, appointment status, assigned Doctor, recent notifications, and unread count. Session-derived UserProfile identity resolves the linked Patient; no client identity or owner field is accepted. Appointment reads expose only date/time, status, Patient-visible visit type, and Doctor display name, with at most three upcoming results. Notification reads use the existing recipient-private service and expose at most three existing Patient-safe UI notifications; no notification is marked read. Manila-time `today`/`tomorrow` matching and display are deterministic, while multiple plausible status targets do not guess. Safety classification runs before tools, and broad, injection, ownership-bypass, hidden-field, or other-Patient requests execute no read. Fixed server templates receive the minimum tool result, and no model or external service receives it. Clinical records, prescriptions, diagnoses, notes, certificates, allergies, emergency contacts, Patient profile health fields, mutation services, persistent chat, new schema, UI, provider, environment change, and deployment remain excluded.

Milestone 1.31 adds a backend-only OpenAI Responses API adapter behind the existing internal-first assistant. External AI is off by default and only three locally allowlisted, non-sensitive conversational tasks can reach it. Eligible wording is converted to canonical server-owned prompts containing a small approved fact fragment; raw Patient messages, live Patient tool results, identity/contact information, clinical content, and chat history never leave Arion. The configured `gpt-5.6-luna` request is stateless, tool-free, minimal-reasoning, capped at 300 output tokens, and subject to a five-second timeout. Disabled, missing, unsupported, timed-out, rate-limited, upstream-error, or invalid-response cases return a fixed internal fallback. Known knowledge, live tools, sensitive content, injection attempts, and unsupported requests remain internal. GPT telemetry is content-free and identifier-free. No UI, schema, persistence, package, real key, deployment, or Production configuration was added.

Milestone 1.32 adds the visible Arion Assistant experience only to the authenticated Patient layout. A fixed launcher opens a responsive, keyboard-operable text chat with a local welcome, visible non-clinical disclaimer, eight backend-routed suggestions, loading and safe error feedback, plain-text replies, clear chat, close/focus return, and narrow-mobile viewport constraints. The browser service posts only `{ message }` to the existing endpoint. Conversation history is React state only and disappears on clear, reload, logout, or unmount; no browser or server persistence exists. No backend assistant logic, live-data scope, provider eligibility, database schema, dependency, secret, Production configuration, or deployment changed. Playwright explicitly keeps `AI_EXTERNAL_ENABLED=false`.

Milestone 1.33 adds a distinct public Arion Assistant safe mode to the landing, Login, Register, and Forgot Password pages for unauthenticated visitors. It reuses the chat presentation with separate public welcome text, suggestions, frontend service, and backend endpoint. A centralized public allowlist answers only general registration, login, verification, recovery, appointment-process/status, queue, Medical Records, Certificates, and scope questions. Personal questions direct visitors to sign in. Emergency and health/clinical routing takes precedence, and unsafe requests fail closed. The public backend never imports or calls Patient tools, repositories, databases, or AI providers and has its own five-per-minute per-IP limiter namespace. Public and Patient chat instances unmount across authentication transitions so conversation state cannot cross the guest/authenticated boundary. No persistent chat, schema, dependency, external-AI, cloud, or deployment change is included.

Milestone 1.34 replaces the flat suggestion chips in both assistant modes with centrally configured topic categories and question lists. Visitors and Patients first choose a topic, can return with Back to topics, and can reopen the guide after an answer with Browse topics; selecting a question immediately sends the approved text. Public and authenticated category sets remain distinct, keyboard focus follows category navigation, and the layout collapses to one column at 320-pixel widths. Deterministic matching now recognizes broader Patient-friendly wording for appointment, account, record, certificate, notification, queue, arrival, OTP, Profile, and phone-format help. Broad help remains internal and invokes neither live Patient tools nor GPT; specific live-data requests, health/emergency safety, unsafe-request handling, and the existing three GPT-eligible canonical tasks retain their boundaries. There is no new data access, action, provider scope, persistence, schema, dependency, environment change, deployment, or Milestone 1.35 work.

Milestone 1.35 performs the final local Arion Assistant v1 safety and acceptance gate without adding features. The completed review confirms separate public and authenticated Patient modes, Patient-only RBAC and ownership-derived live reads, deterministic internal-first routing, sensitive/emergency/injection precedence, the three-task optional GPT allowlist, read-only behavior, session-only UI state, separate rate-limit namespaces, and content-free logging. The final architecture, defense-ready flows, and known v1 limitations are documented in `PROJECT_SPEC.md`. External AI remained disabled, no real provider request was made, no database/schema/dependency/environment change occurred, and nothing was deployed.

Milestone 1.36 adds the backend/storage foundation for appointment-bound **Consultation Supporting Documents**. Active Patients may upload PDF, JPG/JPEG, or PNG files only to their own Pending or Confirmed appointment before a Medical Record exists, with actual file-signature validation, 5 MB per-file, five-file, and 25 MB appointment limits. Binary data is privately stored in MongoDB GridFS and minimal ownership metadata is stored in `consultation_supporting_documents`; generated storage names and authenticated Patient/Doctor streaming avoid public URLs. Patients retain access after record creation, while the assigned Doctor's temporary consultation access ends when the Medical Record exists; Staff, Admin, unrelated Doctors, and other Patients have no content access. Uploaded files are immutable, never enter MedicalRecord, and are isolated from Arion Assistant, GPT, OCR, email, and other providers. The later booking UI will select files without categories and upload them only after appointment creation; no UI, deletion/replacement flow, deployment, or Production configuration was added here.

Milestone 1.37 adds the Patient-facing portion of consultation supporting documents. The Book Appointment page accepts optional PDF/JPG/JPEG/PNG selection with local removal and the existing five-file, 5 MB each, 25 MB combined limits. It has no category or description field. Appointment creation always happens first; selected files upload only after creation succeeds. An upload failure leaves the appointment intact and produces a clear partial-success confirmation.

Patient Appointment Details lists the authenticated Patient's documents for that exact appointment. Medical Record Details lists only documents attached to the record's linked visit. Downloads use the existing authenticated appointment-scoped backend route, with no public URL or browser persistence. There is no global document page or history. Doctor, Staff, and Admin frontend behavior remains unchanged; Doctor backend access remains governed by the Milestone 1.36 assignment and Medical Record cutoff. No OCR, AI file access, summarization, delete/replace UI, schema change, new storage provider, dependency, environment change, or deployment is part of 1.37.

Milestone 1.38 completes Consultation Supporting Documents v1 for the assigned Doctor. The exact appointment's files appear read-only inside the existing Consultation tab and Add Medical Record flow, with authenticated blob retrieval and no separate tab or cross-visit history. The shared Patient/Doctor UI opens PDFs and images in a full-screen scrollable viewer that closes with X or Escape and exposes no download action. The Doctor receives no upload, edit, delete, replace, categorization, or annotation action, and document data is never added to the Medical Record payload. A successful Medical Record save immediately unmounts the file section; existing-record consultations do not render filenames or counts, and backend list/download access is denied after that point. The Patient retains access through the appointment and matching Medical Record Details, while Staff, Admin, unrelated Doctors, other Patients, and swapped appointment/document requests remain blocked. Files remain outside Assistant, GPT, OCR, extraction, summarization, email, and external providers. No schema, dependency, environment, cloud, or deployment change was made.

## Roles and permission boundaries

- **Patient:** manages their own profile, books and views their own appointments, reschedules eligible Patient-created appointments by date/time only until one hour before the original start, and reads their own records and issued certificates. Rescheduling keeps the same Doctor and Appointment ID and resets status to pending. Patient ownership is derived from the authenticated profile.
- The Patient profile opens read-only and requires Edit Profile before approved fields become editable, with visible save feedback. Emergency contacts remain Patient-self-view only; related Doctors may see allergies and PWD status, while Staff may see PWD status but not allergies or emergency contacts. Patient appointment All, Upcoming, and Past & Cancelled views and My Records show five items per page; My Certificates uses backend-driven five-item pages independently for Active and Archived without deleting history. Record search resets to the first page.
- All editable portal contact fields—Patient registration/profile contacts, Staff walk-in registration, and Admin Doctor/Staff account management—use one Philippine mobile rule: exactly 11 digits, beginning with `09`, stored without spaces. Space-formatted input is canonicalized safely; letters, punctuation, invalid lengths/prefixes, and `+63` are rejected. The UI ignores a twelfth digit without invalidating a valid 11-digit value and reports incomplete or invalid entries on blur/save. Emergency contact numbers remain optional and use the same rule when supplied. No migration, SMS support, or privacy-boundary change was introduced.
- **Doctor:** uses Dashboard, My Schedule, and Patients. My Schedule is read-only and shows Staff-managed Working Hours, Available Booking Dates, and Time Off / Unavailable. Patients is derived only from the Doctor's assigned appointments, never the clinic-wide Patient directory. Patient Detail separates Overview, Consultation, Medical Records, and Certificates while preserving relationship checks. The Doctor creates one MedicalRecord for an eligible assigned consultation, issues certificates only through the approved flow, and completes the consultation after its record is saved. Saved records and issued certificates are read-only. Priority audit history is read-only and limited to appointments assigned to that Doctor.
- **Staff:** uses the Patients directory and Patient Detail page for demographics, portal-link status, and operational Appointment history covering date/time, status, Doctor, visit type/reason, arrival, priority, and origin. Portal-linked and walk-in/unlinked Patients are both supported. Staff also manages Doctor schedules, the operational calendar, walk-ins, atomic Confirm Arrival, queue, compatibility confirmation, cancellation, and explicit no-show actions after the five-minute grace period. The Dashboard previews five active-queue patients; Patients, Doctors, Notifications, each Patient's Appointment History, and each tabbed Active/Scheduled/Completed-Cancelled-No-show queue view show five items per page. The walk-in page shows the five most recent consultation dates, omits the duplicate queue preview, and loads the selected Doctor's authoritative published same-day schedule; occupied times remain visible but disabled, and creation repeats server-side availability validation. Checked-in confirmed appointments may be marked Urgent only with an approved reason; returning to Normal requires a correction reason, and every change is transactionally appended to priority audit history. Staff may view read-only clinic Analytics for Today, This Week, and This Month. Staff receives no diagnosis, clinical notes, prescriptions, certificate clinical content, or Patient-identifying analytics and cannot complete consultations or edit clinical content.
- **Admin:** provisions and activates/deactivates Doctor, Staff, and Patient portal accounts and may view the same read-only, aggregate clinic Analytics after MFA authentication. Admin is not a clinical superuser and cannot edit medical records, Prescriptions, certificates, or Doctor decisions.

Backend authentication, active-account checks, role authorization, and resource ownership enforce these boundaries. Hidden buttons and frontend redirects are convenience controls, not the security boundary.

Clinic Analytics is computed on demand from existing source data and is never written back. Today, Monday-based week, and month boundaries use Asia/Manila. “Patients served” and Senior/PWD counts mean unique Patients with completed appointments; appointment volume and unique Patients are labelled separately. Raw Patient names, raw free-text visit reasons, urgency explanations, and clinical content are excluded. New-versus-returning analysis is deferred.

The v1.1 notification backend foundation adds one recipient-private `Notification` collection and shared authenticated inbox APIs for active Patient, Staff, Doctor, and fully MFA-authenticated Admin accounts. Every record belongs to one exact UserProfile recipient; Admin has no global inbox access. Listing is newest first with validated unread filtering and bounded pagination, and recipient-only mark-one/mark-all operations are idempotent and use server timestamps. Responses omit recipient identity and authentication data.

New Notification documents may also contain only the optional server-derived `patient_display_name`, `doctor_display_name`, and `appointment_at` fields. Context is role-minimized: Patient gets Doctor name and own schedule, Staff gets operational Patient/Doctor names and schedule, Doctor gets related Patient name and schedule, and Admin gets no routine Appointment context. Existing records remain compatible without migration. Clinical details, visit and urgency reasons, contact/demographic data, actor IDs, and arbitrary metadata remain excluded.

Notification creation is internal-only through a strict service allowlist; users have no POST creation route. Successful Patient booking notifies all active Staff and the assigned active Doctor; Staff-created appointments notify the assigned active Doctor. Pending-to-confirmed notifies a linked active Patient. Confirm Arrival notifies the assigned active Doctor; rescheduling and Patient cancellation notify linked Patient plus all active Staff plus assigned Doctor; Staff cancellation notifies linked Patient plus assigned Doctor but not Staff or Admin; Normal-to-Urgent notifies assigned Doctor; and Doctor completion notifies linked Patient. Admin receives no routine workflow events, Set Normal generates none, and unlinked walk-ins or inactive recipients are skipped. Every notification uses only fixed non-clinical wording and an Appointment related-resource reference.

Triggers run only after the underlying guarded mutation succeeds, preventing failed/repeated actions from creating duplicates. Notification delivery is best effort after the business transition: failures do not roll back booking or state changes, Staff fan-out continues for other recipients, and safe logs contain only event type, recipient role, Appointment ID, outcome, and timestamp.

The v1.1 notification UI is shared across all fully authenticated role layouts. A header bell shows the unread count (capped visually at `99+`) and keeps its five-item panel compact. Protected role pages at `/patient/notifications`, `/staff/notifications`, `/doctor/notifications`, and `/admin/notifications` provide All/Unread filters, five-item previous/next pagination, individually separated richer operational cards, labelled Appointment and event times, Mark all as read, explicit unread-item Mark as read buttons, and a confirmation-protected Clear notifications action. Clear-all is recipient-scoped and soft-dismisses visible records, resets the recipient's unread count, and preserves database history. Older records remain visible because a missing dismissal field matches the active-inbox query. Count/list refreshes remain initial and action-driven only; no polling or realtime transport was added. Notifications do not navigate to related resources because the backend intentionally exposes no validated action path. Logout unmounts and clears notification UI state, and the Admin bell/page cannot mount until MFA establishes the full Admin session.

No reminder job, email/SMS/push delivery, preferences, hard deletion, restore/unarchive, mark-unread behavior, TTL, deployment, or environment change is included.

## Authentication and security model

- One `/login` route serves all roles; `/register` is Patient-only.
- New self-registered Patients continue at `/verify-email`; verification uses a masked destination, a temporary HttpOnly cookie, and never creates a login session automatically.
- Correct credentials for an unverified Patient resume verification and issue no `arion_auth` cookie. Legacy Patient, Doctor, Staff, and Admin login behavior remains compatible.
- Patient password recovery uses a generic forgot response and an exchanged opaque HttpOnly reset cookie. It never recovers Staff, Doctor, or Admin accounts, bypasses inactive status, changes verification state, or creates a login session.
- Doctor and Staff accounts are Admin-provisioned. The permanent Admin is created only through the controlled offline bootstrap script.
- Authentication uses an eight-hour `arion_auth` HttpOnly, Secure-in-Production, SameSite=Lax, host-only cookie scoped to `/`. Tokens are not stored in localStorage or sessionStorage.
- Admin password verification creates only a short-lived MFA challenge. TOTP verification is required before an Admin session is issued.
- Account statuses are `active` and `inactive`. Deactivation blocks access without deleting identity or historical data.
- Exact-origin credentialed CORS, Helmet headers, bounded request bodies, allowlisted input, ObjectId validation, ownership checks, and shared MongoDB rate limiting are enforced by the backend.
- Security events are structured and redacted. Credentials, tokens, cookies, MFA material, connection strings, signature paths, and clinical content must never be logged.
- Secret values belong only in ignored local environment files or the deployment secret store. They must never be committed or placed in public `VITE_` variables.

## Final validation baseline

- Frontend tests: **107/107 passed**
- Backend tests: **242/242 passed**
- Playwright E2E journeys: **48/48 passed**
- Production build: **passed**
- Frontend dependency audit: **0 known vulnerabilities**
- Backend dependency audit: **0 known vulnerabilities**
- Live Production role smoke, MFA/session/logout, ownership, lifecycle, CORS, rate limiting, headers, log redaction, and certificate fail-closed checks: **passed**
- Exact disposable Production smoke cleanup: **passed**; permanent Admin remained active and MFA-enrolled

This is a point-in-time baseline. Re-run the appropriate checks after application, dependency, configuration, or infrastructure changes.

Milestone 1.25 local validation recorded **371/371 backend tests passed**, **149/149 frontend tests passed**, and a successful Production frontend build. Milestone 1.26 local validation records **378/378 backend tests**, **151/151 frontend tests** using sequential per-file execution required by the restricted Windows sandbox, **72/72 Playwright browser journeys**, a successful Production frontend build, clean whitespace validation, and **0 known frontend or backend dependency vulnerabilities**. Milestone 1.27 local validation records **386/386 backend tests**, **153/153 frontend tests** using the same per-file method, **76/76 Playwright browser journeys**, a successful Production frontend build, clean whitespace validation, and **0 known frontend or backend dependency vulnerabilities**. Milestone 1.28 local validation records **396/396 backend tests**, **155/155 frontend tests** using the same per-file method, a successful Production frontend build, clean whitespace validation, and a clean assistant provider/secret scan. Milestone 1.29 local validation records **416/416 backend tests**, **155/155 frontend tests**, a successful Production frontend build, clean whitespace validation, and clean assistant external-provider, persistence, and sensitive-pattern scans. Milestone 1.30 local validation records **431/431 backend tests**, **155/155 frontend tests** using sequential per-file execution required by the restricted Windows sandbox, a successful Production frontend build, and clean provider, sensitive-data, mutation, schema-impact, and whitespace scans. Milestone 1.31 local validation records **444/444 backend tests**, **155/155 frontend tests** using the same sequential method, a successful Production frontend build, and clean secret, provider-boundary, persistence, schema/dependency, and whitespace scans. Playwright was not rerun for 1.28–1.31 because none of these milestones adds UI. Milestone 1.32 local validation records **444/444 backend tests**, **160/160 frontend tests**, all **79/79 Playwright browser journeys covered successfully** after enforcing the intended fake-email E2E provider, a successful Production frontend build, clean whitespace validation, and clean frontend secret, provider, and assistant-persistence scans. Milestone 1.33 local validation records **455/455 backend tests**, **166/166 frontend tests**, one clean **87/87 Playwright** run from startup with fake email and external AI disabled, a successful Production frontend build, and clean public-provider, live-tool, persistence, schema/dependency, sensitive-logging, and whitespace scans. Milestone 1.34 local validation records **494/494 backend tests**, **166/166 frontend tests**, focused **11/11 assistant Playwright journeys**, one clean full **87/87 Playwright** run from isolated startup with fake email and external AI disabled, a successful Production frontend build, clean whitespace validation, and clean provider, sensitive-data, persistence, schema/dependency, and category-configuration scans. No Preview or Production validation/deployment was performed for these post-MVP milestones.

Milestone 1.35 final local acceptance records **494/494 backend tests**, **166/166 frontend tests**, and a clean isolated Playwright run with **86 passed, 1 time-dependent same-day-slot test skipped, and 0 failed** using fake email and external AI disabled. The Production frontend build passed with the existing non-blocking large-chunk warning. Final whitespace, secret/provider boundary, mode-isolation, persistence, logging, mutation, schema, and dependency-change reviews passed. Real OpenAI access was intentionally not exercised and remains a separate Production-readiness prerequisite. No deployment was performed.

Milestone 1.36 local validation records **526/526 backend tests**, including **31/31 focused supporting-document tests**, and **166/166 frontend tests**. The Production frontend build passed with the existing non-blocking large-chunk warning. Frontend and backend dependency audits report zero known vulnerabilities. Secret, public-storage URL, cloud-storage SDK, AI coupling, route mutation/access-boundary, and whitespace scans passed; the AWS credential-provider name that remains in the backend lockfile is an uninstalled optional MongoDB-driver entry, not an added storage provider. Playwright was not run because 1.36 adds no UI. No deployment was performed.

Milestone 1.37 local validation records **179/179 frontend tests**, **526/526 backend tests**, including **13/13 focused frontend workflow/API tests** and **31/31 focused supporting-document backend tests**, and a clean **91/91 Playwright** run with the required fake-email test provider. The Production frontend build passed with the existing non-blocking large-chunk warning. Both dependency audits report zero known vulnerabilities. Whitespace and supporting-document privacy/boundary scans passed. No schema, dependency, environment, cloud, or deployment change was made.

Milestone 1.38 local validation records **189/189 frontend tests**, **526/526 backend tests**, including **23/23 focused Patient/Doctor supporting-document frontend tests** and **31/31 focused supporting-document backend tests**, plus one clean isolated **92/92 Playwright** run with the fake email provider and external AI disabled. The Production frontend build passed with the existing non-blocking large-chunk warning. Frontend and backend dependency audits report zero known vulnerabilities. Whitespace, secret, public-URL/storage, Staff/Admin exposure, Doctor post-record cutoff, cross-appointment isolation, and AI/OCR coupling scans passed. No backend, schema, dependency, environment, cloud, or deployment change was made.

## Production restrictions and data policy

Production must contain synthetic/demo data only. Do not enter, import, retain, or process real patient information, diagnoses, notes, Prescriptions, certificates, or other clinical data.

Current limitations:

- Atlas Free has no managed backup or point-in-time recovery.
- Vercel Hobby has short-lived runtime logs and no Log Drain.
- Durable monitoring, durable security-log retention, and operational alerting are not configured.
- Protected Doctor signature object storage and authorized signature rendering are not implemented.
- Production certificate issuance is disabled in the frontend and backend.
- Admin MFA recovery codes and self-service MFA recovery are not implemented.
- Manual backups, when explicitly approved, are point-in-time archives and do not provide continuous disaster recovery.

## Requirements Before Real Clinical Use

Real clinical use is not authorized until all of the following are designed, implemented, independently reviewed, and successfully tested:

1. Approved legal, privacy, clinical-governance, and data-retention requirements for the intended jurisdiction.
2. A production database plan with managed backups, point-in-time recovery, tested restores, documented recovery objectives, and restricted operator access.
3. Durable security/application logs with approved retention, access controls, alerts, incident response, and audit review.
4. Production-grade availability monitoring, error monitoring, latency monitoring, capacity thresholds, and on-call ownership.
5. Protected Doctor signature storage and authorization, safe certificate rendering, key/storage rotation, and a review of certificate legitimacy requirements before enabling issuance.
6. Admin MFA recovery and break-glass procedures that preserve identity verification and auditability.
7. A threat model, access-control review, privacy review, dependency review, penetration/security testing, and remediation of all material findings.
8. Confirmed clinic hours, operating policy, queue/urgency policy, and accountable clinical owners.
9. Data migration, validation, support, training, change-management, and downtime procedures.
10. A documented secret-rotation procedure covering authentication, MFA encryption, Atlas credentials, sessions, redeployment, validation, and recovery impact.
11. A controlled production-readiness exercise covering deployment, rollback, database recovery, secret rotation, incident response, and business continuity.

Completing the software MVP or passing the current automated tests does not satisfy these requirements by itself.

## Admin operations and secret custody

- The permanent Production Admin is active and TOTP-enrolled. No public Admin registration route exists.
- Temporary `ADMIN_*` bootstrap variables were removed after the one-time bootstrap and must remain absent during normal operation.
- The Admin password, TOTP custody information, `AUTH_SECRET`, `MFA_ENCRYPTION_KEY`, and Atlas credentials must remain outside Git in approved secure custody.
- `MFA_ENCRYPTION_KEY` must remain stable and backed up securely. Losing or changing it can make enrolled Admin MFA secrets unreadable.
- Lost Admin MFA currently requires a controlled offline operator recovery process; never edit encrypted MFA fields directly.

Environment variable names, without values:

| Scope | Names |
| --- | --- |
| Backend required before deploying the 1.25 foundation | `MONGODB_URI`, `MONGODB_DB_NAME`, `NODE_ENV`, `CORS_ORIGIN`, `AUTH_SECRET`, `MFA_ENCRYPTION_KEY`, `ACCOUNT_TOKEN_HMAC_SECRET`, `CLINIC_NAME`, `CLINIC_LOCATION`, `CLINIC_TIME_ZONE` |
| Backend email verification delivery (required before deploying 1.26) | `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, `EMAIL_FROM`, `APP_BASE_URL` |
| Backend optional/configured when approved | `CLINIC_OPEN_TIME`, `CLINIC_CLOSE_TIME`, `CERTIFICATE_ISSUANCE_ENABLED`, `AUTH_LOGIN_RATE_LIMIT_WINDOW_MS`, `AUTH_LOGIN_RATE_LIMIT_MAX`, `AUTH_REGISTER_RATE_LIMIT_WINDOW_MS`, `AUTH_REGISTER_RATE_LIMIT_MAX`, `ADMIN_PROVISION_RATE_LIMIT_WINDOW_MS`, `ADMIN_PROVISION_RATE_LIMIT_MAX`, `MFA_VERIFY_RATE_LIMIT_WINDOW_MS`, `MFA_VERIFY_RATE_LIMIT_MAX`, `EMAIL_VERIFICATION_ATTEMPT_RATE_LIMIT_WINDOW_MS`, `EMAIL_VERIFICATION_ATTEMPT_RATE_LIMIT_MAX`, `EMAIL_VERIFICATION_RESEND_RATE_LIMIT_WINDOW_MS`, `EMAIL_VERIFICATION_RESEND_RATE_LIMIT_MAX`, `FORGOT_PASSWORD_RATE_LIMIT_WINDOW_MS`, `FORGOT_PASSWORD_RATE_LIMIT_MAX`, `PASSWORD_RESET_RATE_LIMIT_WINDOW_MS`, `PASSWORD_RESET_RATE_LIMIT_MAX`, `ASSISTANT_MAX_MESSAGE_LENGTH`, `ASSISTANT_RATE_LIMIT_WINDOW_MS`, `ASSISTANT_RATE_LIMIT_MAX` |
| Backend SMS foundation (disabled until separately activated) | `SMS_ENABLED`, `SMS_PROVIDER`, `UNISMS_API_KEY`, `UNISMS_SENDER_ID`, `CRON_REMINDER_SECRET`, `SMS_PROVIDER_TIMEOUT_MS`, `SMS_SCHEDULER_RATE_LIMIT_WINDOW_MS`, `SMS_SCHEDULER_RATE_LIMIT_MAX`, `SMS_STALE_PROCESSING_MS` |
| Frontend public | `VITE_API_BASE_URL`, `VITE_CERTIFICATE_ISSUANCE_ENABLED` |
| One-time bootstrap only | `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_DISPLAY_NAME`, `ADMIN_CONTACT_NUMBER` |

For Vercel, `VITE_API_BASE_URL` is intentionally empty because requests use the same origin and already include `/api`. Production certificate flags remain false.

## Deployment, rollback, backup, and monitoring

The deployment path is: Git/code → Vercel build → Vercel Services → Production. Normal deployment builds the Vite frontend and Express service defined in `vercel.json`. Check the deployment source revision, environment scope, build result, `/api/health`, homepage, login, role protection, CORS, and certificate restriction after a release.

For application rollback, select a previously verified Vercel Production deployment using the supported rollback workflow, then repeat the health and security checks. A Vercel rollback does not restore Atlas data. Review schema/model compatibility before rollback.

Atlas Free has no managed recovery. An approved operator may use `server/scripts/backupProduction.ps1` for a manually confirmed `mongodump` to an encrypted operator-controlled destination. Restore tests are allowed only into a disposable local/test database, never Production. Record the archive checksum and non-sensitive outcome in the private operator log.

Follow [OPERATIONS_RUNBOOK.md](OPERATIONS_RUNBOOK.md) for incident response and the weekly/monthly checklist. Weekly work includes health, deployment, runtime error, Atlas capacity, security-event, synthetic-data, and certificate-restriction checks. Monthly work includes dependency audits, secret/access review, approved backup handling, restore-readiness review, notification-recipient review, and environment-isolation checks.

## Medical certificate status

Certificate creation and authenticated PDF behavior remain testable locally and in the isolated Preview environment. Restricted Production disables both the Doctor issuance UI and backend issuance endpoint because protected Doctor signature storage and authorized rendering are unfinished. Do not enable `CERTIFICATE_ISSUANCE_ENABLED` or `VITE_CERTIFICATE_ISSUANCE_ENABLED` in Production until the real-clinical-use requirements and signature work are complete.

## Post-MVP Feature Development

Treat every new request as a separate post-MVP milestone. The release workflow is: feature request → impact analysis → implementation → unit/backend tests → security regression → E2E coverage → Preview deployment → Preview validation → Production deployment → Production smoke test.

Operational rules:

1. Start from the source-of-truth documents and this handoff.
2. Define the exact scope, roles, data changes, routes, authorization, operational impact, and out-of-scope behavior before coding.
3. Update `PROJECT_SPEC.md`, `SCHEMA.md`, `ERD.md`, and `SITEMAP.md` only when an approved decision requires it.
4. Preserve the service/repository boundary, environment isolation, authentication, authorization, read-only clinical rules, and synthetic-only Production policy.
5. Add focused unit/integration tests and role/ownership security regression coverage.
6. Validate locally and in Preview before any controlled Production change.
7. Require explicit approval for cloud mutations, secret changes, migrations, destructive operations, certificate enablement, or production data changes.
8. Update this handoff and the operations runbook when the operational truth changes.

Suggested post-MVP backlog, not approved implementation work:

- Patient cancellation cutoff policy;
- Doctor emergency-unavailability and rescheduling workflow;
- real SMS/cron activation and broader email notification delivery;
- Admin MFA recovery codes and controlled recovery tooling;
- certificate QR verification;
- protected Doctor signature storage and authorized rendering;
- production-grade backup/PITR with tested recovery objectives;
- durable security logs, monitoring, and alerts;
- approved clinic hours and operational policy configuration;
- accessibility, performance, and cross-browser audits;
- privacy/legal/security review for the intended jurisdiction;
- deployment automation and change-control policy;
- a custom domain and its cookie/CORS/operational review;
- real-data migration planning only after authorization for clinical use.

## Future-session handoff

Milestone 1.40 connects the provider-neutral SMS foundation to approved Appointment lifecycle rules. Patient-created Pending bookings receive the boundary-tested immediate/24-hour/1-hour plan when enabled. Rescheduling invalidates the prior version, increments the version, sends the immediate update, and creates a fresh timed plan. Cancellation invalidates unsent work and sends its immediate update; confirmation/arrival, no-show, and completion invalidate without sending. Staff-created Confirmed walk-ins remain ineligible.

The `appointment_sms_reminders` collection contains no message body or phone snapshot. Due processing atomically claims and revalidates current Appointment status, arrival, scheduled instant, newest reminder version, Patient, and current contact number. The scheduler response and logs contain no Patient name, phone number, SMS text, or secret. SMS remains disabled by default; no real SMS was sent, no cron-job.org job was configured, and no deployment occurred. Production activation still requires separately approved secrets, Sender ID, scheduler setup, operational ownership, and restricted-Production review.

Milestone 1.41 validates the UniSMS adapter against the official single-message API. It uses `POST https://unismsapi.com/api/sms`, Basic authentication with the API secret and blank password, and the exact `recipient`, `content`, and `sender_id` request fields. Only an HTTP `201` response with nested `message.reference_id` and an accepted status becomes Arion `sent`; malformed success responses fail closed. Normalized results retain only safe provider metadata and latency. Arion `sent` means submitted to UniSMS, not guaranteed handset delivery.

UniSMS message lookup and authenticated webhook events are documented, but the webhook is deferred for v1 to avoid a new public callback, secret, provider payload boundary, and delivery-state subsystem. Timeouts and dropped connections are never automatically retried because submission may have occurred. Fake, disabled, and real modes remain isolated; there is no real-to-fake fallback. SMS remains off by default, and no paid SMS was sent.

For a later separately approved activation, create a cron-job.org job using `POST https://<YOUR-ARION-DOMAIN>/api/internal/sms-reminders/run` every five minutes, no body, a 60-second timeout, and `Authorization: Bearer <CRON_REMINDER_SECRET>`. The secret must be backend-only, uncommitted, unique, and at least 32 characters. A successful run returns only `processed`, `sent`, `failed`, `invalidated`, and `skipped` counts. Do not configure this job against Production until the user separately approves the environment values, provider activation, operational ownership, and restricted-Production review.

Milestone 1.42 replaces new-certificate free-text purpose entry with the eight approved purpose choices, conditionally requires a bounded plain-text custom purpose for Other, retains a concise editable Diagnosis Summary, and adds a required concise Doctor Recommendation. The backend assigns the issue date from the configured clinic timezone and derives consultation date from the linked Appointment. A centralized deterministic helper generates the purpose-specific formal statement; the client cannot submit or override it. Certificate responses and the existing simple PDF now include the generated statement, Recommendation, and trusted consultation date while excluding prescriptions, full notes/follow-up, supporting documents, allergies, emergency contacts, and queue data.

The schema remains backward compatible: legacy `purpose` stays readable, new records additionally store nullable `purpose_code`, `custom_purpose`, and `recommendation`, and legacy records may keep those fields null. Issued certificates remain immutable with no update/delete routes. Doctor ownership/RBAC and the Production `CERTIFICATE_ISSUANCE_DISABLED` gate are unchanged. The professional PDF redesign remains deferred to Milestone 1.44. No deployment occurred, and local SMS remains disabled.

Milestone 1.43 adds Doctor-owned certificate-signature management under `/doctor/profile`. Active Doctors can upload or replace one genuine PNG (maximum 1 MB, 200×50 through 2000×1000 pixels), see an authenticated preview, and review its last-updated metadata. Preview bytes use a temporary browser object URL that is revoked on replacement and unmount; no storage ID or public URL reaches the UI.

The backend stores bytes in the private `doctor_signature_files` GridFS bucket and one active metadata document per Doctor in `doctor_signatures`. Owner identity is derived from the authenticated Doctor session. Patient, Staff, Admin, unrelated Doctor, inactive, and unauthenticated access is denied. Safe replacement uploads first, switches metadata second, and cleans the prior file last; metadata failure preserves the old signature. There is no delete endpoint or Admin signature-management field.

`getDoctorSignatureForCertificate(doctorId)` is available only as an internal service hook for Milestone 1.44. No certificate PDF was changed and no old issued certificate is mutated. Production certificate issuance and SMS remain disabled. No dependency, environment variable, provider, cloud resource, deployment, or external processing was added.

Milestone 1.44 consumes that hook only during new local/test issuance. It generates the final professional A4 certificate server-side, embeds the active signature once, stores the immutable PDF in private GridFS `medical_certificate_files`, and saves its immutable reference, SHA-256, size, renderer version, and generation time on MedicalCertificate. Authenticated Patient-owner and issuing-Doctor routes stream the exact stored bytes. Replacing the current Doctor signature cannot change historical PDFs.

Legacy certificates remain readable using a signature-free compatibility PDF and never adopt the current signature. Staff/Admin permissions are unchanged, there is no public certificate or signature URL, and no prescriptions, full notes, supporting-document data, or raw storage identifiers appear in the PDF/API. The Production backend and frontend certificate issuance flags remain disabled. No deployment, provider, environment-variable, or dependency change was made.

Milestone 1.44.1 replaces the generic PDF cross with the user-supplied transparent Arion medical logo bundled at `server/src/assets/arion-medical-logo.png` and refines the same A4 renderer with formal blue accents, improved spacing, and cleaner information sections. The concept artwork is inspiration only and is not embedded as a background; no marketing tagline or external image URL is present.

The Doctor issue screen now embeds a Blob-backed PDF from an authenticated, owner-scoped draft-preview endpoint instead of maintaining a separate HTML certificate mockup. The endpoint reuses final validation, trusted relationship derivation, active private signature access, and the exact final renderer, but returns `DRAFT PREVIEW`, consumes no number, and persists no certificate or GridFS artifact. Frontend requests are debounced and race-safe, temporary URLs are revoked, and no browser storage is used. Final issuance remains a fresh render through the immutable artifact/hash flow. Production issuance remains disabled and no deployment occurred.

Milestone 1.45 adds a third **History** view inside Doctor **My Schedule**. It is a read-only, authenticated projection of only the signed-in Doctor's past Completed, Cancelled, and No-show appointments. The default Last 30 Days range and Today, Last 7 Days, This Month, or Custom Range options use Manila calendar boundaries; status, Patient-name, and approved visit-type filters can be combined. The backend validates every filter, fixes the page size at 10, and sorts newest first with a stable identifier tie-breaker.

History rows contain only safe operational summary fields and reuse Doctor Patient Detail for navigation. A Medical Record link is returned only when a record exists for that exact owned Appointment. No clinical content, documents, certificates, contact data, broad Patient history, mutation, export, new collection, dependency, environment change, notification/SMS change, or deployment was added. One supporting Appointment compound index covers Doctor, descending appointment time, terminal-status filtering, and stable pagination.

Milestone 1.46 replaces the Staff Appointment Queue's current-day terminal tab with a clinic-wide, read-only **Appointment History** view. Active Queue and Scheduled keep their existing operational behavior. Staff history is backend-filtered to past Completed, Cancelled, and No-show Appointments, defaults to Last 30 Days, uses Manila date boundaries, combines date/status/active-Doctor/Patient-name/visit-type filters, and returns exactly 10 newest-first rows per page with a stable identifier tie-breaker.

Only safe operational summaries are returned, with navigation to existing Staff Patient Detail. No clinical content, documents, certificates, signatures, account/contact data, Assistant information, notification content, or SMS details are exposed. Patient, Doctor, Admin, inactive, and unauthenticated access are denied. One supporting Appointment index was added; no collection, dependency, environment variable, mutation, export, provider, deployment, notification, SMS, or Doctor History behavior changed.

Milestone v1.2.1 adds the Medical Certificate expiration foundation without changing storage or access architecture. New Doctor issuance and draft preview requests require an explicit `valid_until` date on or after the server-generated Asia/Manila issue date. No fixed duration is invented. Final and preview PDFs use the same renderer and visibly include Date Issued and Valid Until.

Certificate APIs now derive `validity_status`: Active while the clinic date is on or before Valid Until, Expired afterward, and Legacy when an older v1.1 certificate has no validity date. Legacy records and PDFs remain unchanged, issued artifacts remain immutable/private with their existing SHA-256 integrity behavior, and there are still no certificate update/delete routes. Patient archive behavior, expired-download restrictions, Doctor validity filters, backfill, migration, and deployment remain outside this milestone.

Milestone v1.2.2 completes the Patient archive boundary. Patient **My Certificates** now separates Active (including Legacy compatibility records) from Archived (Expired) using strict backend filtering, deterministic newest-first ordering, and five-item pagination per view. Active and Legacy certificates retain existing owner-scoped detail and immutable PDF view/download behavior. Archived rows and direct expired details expose only safe certificate metadata and no View/Download action or PDF preview.

The Patient PDF endpoint recalculates validity using the server's Asia/Manila date immediately before artifact access and returns `403 CERTIFICATE_EXPIRED` for expired certificates without opening GridFS or returning PDF bytes. Ownership is still checked first. The immutable record/artifact, hash, embedded issuance-time signature, and Doctor access remain unchanged; Staff/Admin still receive no certificate content. No archive field/collection, schema migration, expiration notification, provider/environment change, deployment, Patient edit/reissue, or v1.2.3 Doctor filtering was added.

Milestone v1.2.3 completes the v1.2 certificate access model. The existing Doctor **Patient Details → Certificates** tab now provides backend-filtered All, Active, Expired, and Legacy history with fixed five-item pagination and deterministic newest-first sorting. Validity remains server-derived using Asia/Manila. The issuing Doctor can open and download the original private PDF in every validity state, including Expired and Legacy, while another Doctor remains denied.

Issued certificates remain read-only and immutable: there is no edit, extension, update, delete, signature replacement, PDF mutation, or same-record reissue endpoint. A Doctor must issue a new certificate when another valid document is required. Patient v1.2.2 behavior remains Active view/download, Expired Archived metadata-only with `403` artifact denial, and Legacy compatibility access. Staff/Admin receive no certificate content. No schema, collection, migration, provider, environment, notification, or deployment change occurred.

For a new development session, begin with:

> Continue Arion Health Portal from the completed MVP baseline in `PROJECT_HANDOFF.md`. Read `AGENT.md`, `PROJECT_SPEC.md`, `SCHEMA.md`, `ERD.md`, `SITEMAP.md`, `README.md`, and `OPERATIONS_RUNBOOK.md`. Production is DEPLOYED + RESTRICTED and synthetic-only. Preview is isolated. Do not enable Production certificates, use real clinical data, change secrets/cloud resources, or implement backlog items without explicit scope and approval. Preserve 107 frontend, 242 backend, and 48 E2E baseline behavior and add tests for approved changes.

## Final classification

**Safe for:** school/demo presentation, synthetic workflow demonstrations, local development, protected Preview testing, and restricted Production smoke validation.

**Not authorized for:** real patient or clinical data, live clinic operations, clinical decision-making, certificate issuance in Production, claims of full disaster recovery or durable audit logging, or unrestricted public healthcare use.

## v1.2.5 handoff — PWD verification foundation

The current local milestone replaces every self-declared PWD control with a private Patient-owned submission flow. `GET /api/patient/pwd-verification` returns status-only data; `POST /api/patient/pwd-verification` accepts exactly `pwd_id_number` and one `document` multipart file. Only an authenticated active Patient may call these endpoints. There is intentionally no raw-document route, reviewer endpoint, notification, or non-Patient UI yet.

`pwd_verifications` has one record per Patient and `pwd_verification_files` contains the private GridFS bytes. ID number, storage reference, stored filename, MIME type, size, SHA-256, and rejection reason are schema-private by default. Submission uses upload-first/metadata-second cleanup, blocks duplicates, and returns controlled failures without file or ID details. The Patient sees Not Submitted, Pending Verification, Verified, or Rejected; rejected resubmission is deferred.

The old `Patient.is_pwd` field remains in the schema strictly for compatibility. It is ignored by queue, Doctor clinical projection, Staff projection, and analytics. Only `PwdVerification.status === verified` supplies PWD classification. Senior DOB and Urgent priority rules are unchanged. Staff cannot grant PWD status when registering a walk-in.

For v1.2.6, add a narrowly scoped Staff verification queue and explicit review transition only after re-reading the v1.2.5 ownership and privacy tests. Do not add direct GridFS/public download, Doctor/Admin review, OCR/AI, or Patient-controlled verification. Add approved outcome notification only after a successful review transition and keep it free of ID/document content.

## v1.2.6 handoff — Staff PWD verification and Patient notifications

The local v1.2.6 milestone completes the manual verification workflow in **Staff → Patients → PWD Verification**. Pending submissions are server-paginated and oldest first. Only an authenticated active Staff account may inspect the full ID number and stream the private PDF/image inline from `/api/staff/pwd-verifications/:verificationId/document`; there is no public URL or download action. Doctor, Admin, Patient, inactive, and unauthenticated access remain denied.

Verify and Reject are single atomic Pending-only transitions. Successful reviews store the current reviewer/time and append an immutable history item. Rejection requires a bounded reason. A rejected Patient sees that reason and may upload a corrected document; the current binary is safely replaced while review history is retained. Verified Patients cannot reset or resubmit their status. Concurrent or repeated reviewers receive `409` rather than overwriting the first decision.

Each successful transition triggers one fixed Patient notification after the database commit. Notification text contains no ID, filename, reason, document details, or URL. Only Verified status affects queue priority. v1.2.6 adds no OCR/AI, automated approval, external verification provider, public storage, environment variable, or deployment.

## v1.2.7 handoff — Official verification review and final PWD workflow

The November 2, 2026 official-source review found no clearly authorized public API for a private clinic to automate Philippine PWD ID verification. NCDA/DSWD materials describe UPWDIS, its QR-based verification experience, and its phased government/LGU rollout, but do not publish a public API contract, private-clinic onboarding process, authentication requirements, or permission for third-party automated querying. NCDA Administrative Order No. 001, s. 2026 instead limits access through roles and formal data-sharing agreements. NPC privacy and scraping guidance means a human-facing page or QR result must not be treated as an undocumented API or scraped dataset.

Manual Staff verification is therefore the final approved design. The Patient submits privately, the record remains Pending, active Staff compares it with the applicable official government registry/source through the official human-facing process, Staff verifies or rejects it, and the Patient receives a privacy-safe notification. Only Verified status affects PWD priority. Senior remains DOB-derived and Urgent remains the highest operational tier.

Do not add OCR, AI legitimacy decisions, portal scraping, browser automation, reverse-engineered endpoints, or government credentials. A future official integration must stop for separate approval and first provide published API documentation, explicit access authorization, authentication/onboarding rules, lawful basis, privacy impact and security review, and any required data-sharing agreement. v1.2.7 changes documentation only and performs no deployment.

## Current PWD submission refinement handoff

New submissions use exactly `front_document` and `back_document` multipart image fields. Both must be JPG/JPEG or PNG and no larger than 5 MB each; PDFs, typed `pwd_id_number`, extra fields, missing sides, mismatched extensions/MIME signatures, and additional files are rejected. Existing one-file records remain readable through the legacy Staff review path only. Rejected resubmission atomically replaces both images after successful private storage while preserving review history.

The Patient is instructed that the printed ID name must match the profile name. Staff sees that profile name next to the two images and is instructed to compare them before using the direct bodyless Verify action. There is no separate confirmation checkbox and no automated OCR/AI verification. A successful submission or resubmission sends all active Staff a fixed privacy-safe `pwd_verification_submitted` notification. Staff Patients shows `PWD Verification (n)` using the Pending-list total and refreshes it after review. No deployment was performed.
# v1.2.11 follow-up recommendation integration

The assigned Doctor can record whether follow-up is required while creating the immutable Medical Record. A required follow-up includes a clinic-date recommendation and a bounded clinical reason. The date cannot precede the consultation date.

Patient and Staff scheduling reuse the existing Doctor availability, conflict, and 14-day booking rules. The Patient or Staff selects the actual slot; the system never books automatically or invents a next-day date. The Appointment links back through `source_medical_record_id`, while the original recommendation remains unchanged after booking, cancellation, or rescheduling. Doctor receives no scheduling mutation permission, and Staff receives no clinical reason.

Recommendations beyond the 14-day horizon remain visible but cannot yet be scheduled. Doctor-unavailability automatic rescheduling is intentionally deferred to v1.2.12. No deployment was performed.

# v1.2.12 handoff — Doctor unavailability rescheduling assistance

Staff may add a bounded whole-day or partial-day Doctor time-off block from the existing schedule page. The backend finds overlapping active Appointments in one batch, adds an explicit Doctor-unavailability flag and block reference, and leaves their original date, status, Patient, Doctor, visit context, and follow-up link unchanged. Terminal Appointments are ignored. Removing the last related block clears an unresolved flag; no Appointment is moved automatically.

The Staff schedule shows the affected count, operational details, up to five ranked replacements, another-date slot lookup, a confirmed Reschedule action, and Leave Pending. The owning Patient sees a generic Doctor-unavailable warning and suggestions only when existing Patient self-reschedule rules permit it. Checked-in or recorded Appointments remain locked and visible for manual Staff handling rather than bypassing lifecycle controls.

Suggestions reuse published availability, Doctor blocks, occupancy, 30-minute slot rules, the 14-day booking horizon, and Asia/Manila time. Final Patient or Staff confirmation revalidates availability and uses an atomic expected-original-time update, so a competing confirmation or stale occupied slot fails safely. The existing Appointment is updated; `source_medical_record_id` remains intact and the source Medical Record recommendation is never rewritten.

Flagging creates fixed privacy-safe Patient/Staff/Doctor notifications, invalidates unsent SMS reminders tied to the invalid schedule, and sends a generic navigation-only Patient email when a portal account exists. The absence note and clinical data are not included. Confirmed moves reuse current reschedule notification, versioned SMS-plan, and email behavior. Side-effect delivery remains best effort and cannot roll back the scheduling state.

No Doctor mutation route, bulk automatic move, duplicate Appointment, auto-cancellation, new provider, environment change, or deployment was added.

# Schedule UI Redesign Milestone 1 handoff

The Staff Doctor Schedule is now a reusable weekly calendar interface. `WeeklyScheduleCalendar` converts the unchanged recurring availability, published one-date availability, and blocked-time response into green, blue, and red visual blocks. `ScheduleDialog` supplies focus handling, Escape close, focus restoration, and labelled modal semantics for schedule actions.

All mutations still call the established Staff scheduling service methods. Recurring hours can be added, edited, enabled/disabled, and deleted; special availability and time off can be added and removed. The affected-appointment rescheduling panel remains intact below the calendar. The calendar is horizontally scrollable on small screens and exposes descriptive keyboard buttons for every event.

Milestone 2 must not assume any new backend data model: this milestone introduced no endpoint, schema, scheduling-rule, permission, or deployment change. Historical blocked/published records remain limited by the existing schedule response, and the visual grid intentionally displays the clinic-day window from 8:00 AM to 6:00 PM.

# Schedule UI Redesign Milestone 2 handoff

The Staff Doctor Schedule now keeps affected Appointments in a compact warning directly under the calendar. **Review Appointments** opens a reusable right-side drawer with operational-only cards and server-provided suggestions. **Leave Pending** closes no records and changes no schedule. A Staff reschedule is written only after a separate confirmation dialog displays the Patient, original time, and replacement time.

After confirmation, the page reloads the authoritative schedule, decreases the affected count, and displays **No appointments need rescheduling** when the list becomes empty. If another booking takes a selected suggestion before confirmation, the existing backend conflict remains authoritative: the Appointment stays affected, the page shows a safe no-longer-available message, refreshes the drawer data, and provides **Reload suggestions**. No automatic move or hidden retry was added.

The calendar now derives its visible hour range from returned events while retaining 8:00 AM–6:00 PM as the minimum baseline. Early or late working hours, special availability, and time off remain visible rather than being clipped. At 390px, calendar columns stay intentionally horizontally scrollable and the review drawer uses the full viewport width. Dialog focus trapping, Escape close, focus restoration, labelled controls, keyboard-selectable blocks, and visible focus treatment remain intact.

This is a frontend-only milestone. It reuses the existing Staff schedule and reschedule APIs and changes no backend behavior, role permission, schema, scheduling rule, notification/email/SMS behavior, provider, environment variable, or deployment. Do not deploy as part of this handoff.

# Weekly booking publication and calendar update handoff

The Staff Doctor Schedule now separates three ideas clearly:

- **Working Hours** are the recurring green schedule template.
- **Published for booking** is the blue Patient-booking layer inside Working Hours.
- **Time Off** is the red striped unavailable layer shown above both.

Staff can publish one date or repeat the same time every selected weekday. A weekly publication begins on its chosen first date and continues until Staff stops it. The event popup stays compact: the close **×** replaces a duplicate Close button, leaving **Change Time**, **Remove This Monday**, and **Stop All Mondays**. **Change Time** opens a second form where Staff chooses one date or all matching weekdays.

Changing one occurrence writes a date-specific time override. It does not change the following weeks. Changing the whole series updates its base time while keeping previously customized dates. Removing one occurrence writes an excluded date; stopping the series removes the complete weekly publication. All edited times must remain inside active Working Hours and cannot overlap another publication.

Patient slot generation now expands weekly publications and applies date overrides and exclusions before Time Off, past-time, occupancy, clinic-hour, and 14-day-horizon checks. The displayed calendar and Patient booking page therefore use the same effective schedule.

The backend additions are Staff-only `PATCH /api/staff/doctors/:doctorId/published-availability/:publishedId` for time edits and `POST /api/staff/doctors/:doctorId/published-availability/:publishedId/exceptions` for removing one weekly date. `DoctorPublishedAvailability` now includes `repeat_weekly`, `excluded_dates`, and `date_overrides`. Existing role boundaries, Appointment history preservation, notification/email/SMS behavior, providers, and environment configuration remain unchanged. No deployment was performed.
# v1.2.16 handoff — Optional Prescription Attachments

- Doctor Medical Record creation now accepts digital Prescription details, one optional JPG/JPEG/PNG/PDF attachment up to 5 MB, or both in the same intentional Prescription row.
- Multipart submissions use one JSON `payload` field and an `attachments` array. Each row references at most one upload through its validated `attachment_index`; duplicate and unreferenced files are rejected.
- Server validation checks file size, non-empty content, extension, MIME type, and binary signature before private storage. Files use generated names in GridFS bucket `prescription_files`; Prescription keeps private metadata and SHA-256 integrity data.
- Record creation remains atomic in behavior. Any attachment uploaded before a storage/database failure is deleted, while the browser keeps the Doctor's local form and file selection for retry.
- Saved Prescription data is read-only. The owning Doctor and owning Patient have separate authenticated download routes; Staff/Admin and unrelated users remain denied. Normal record responses expose safe attachment metadata only, never the GridFS ID or hash.
- No OCR, AI parsing, public link, external storage, notification/email/SMS content, update/delete/replacement route, dependency, environment variable, or deployment was added.
## v1.2.17 handoff — Prescription history and private attachment access

- Doctor route: `GET /api/doctor/patients/:patientId/prescriptions?page=N` returns only the signed-in Doctor's issued prescription rows for that Patient.
- Patient route: `GET /api/patient/prescriptions?page=N` returns only prescriptions linked to the signed-in Patient's Medical Records.
- Both history responses are newest-first, server-paginated at five items, preserve Medical Record/appointment context, and omit private GridFS IDs and hashes.
- Attachment routes accept `?disposition=inline` only to change authenticated response disposition for preview. The default remains an authenticated download. Both stream the original private GridFS bytes with safe MIME, filename, `no-store`, and `nosniff` headers.
- Frontend temporary object URLs are revoked when previews close, files change, or components unmount. No permanent or public attachment URL is created.
- Doctor UI: Patient Details → Prescriptions. Patient UI: My Records → Prescriptions and the existing individual Medical Record detail.
- There are no issued-prescription mutation endpoints or UI controls. Corrections or reissue remain outside this version.
- Staff and Admin receive no prescription history or attachment UI/API access. No OCR, AI transcription, or external-provider transfer was introduced.
- No schema/ERD change was required for v1.2.17; it reuses the v1.2.16 Prescription-to-MedicalRecord relationship and private `prescription_files` GridFS bucket.
- No deployment was performed.
