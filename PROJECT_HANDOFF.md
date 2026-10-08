# Arion Health Portal MVP Handoff

## Final project status

Arion Health Portal has completed MVP development, security hardening, browser regression testing, Vercel deployment, and live synthetic Production validation through Milestone 25.8.

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

## Roles and permission boundaries

- **Patient:** manages their own profile, books and views their own appointments, reschedules eligible Patient-created appointments by date/time only until one hour before the original start, and reads their own records and issued certificates. Rescheduling keeps the same Doctor and Appointment ID and resets status to pending. Patient ownership is derived from the authenticated profile.
- **Doctor:** views assigned Patients and schedule, manages their own availability and blocked time, creates one MedicalRecord for an eligible assigned consultation, issues certificates only through the approved flow, and completes the consultation after its record is saved. Saved records and issued certificates are read-only. Priority audit history is read-only and limited to appointments assigned to that Doctor.
- **Staff:** manages the operational calendar, walk-ins, atomic Confirm Arrival, queue, compatibility confirmation, cancellation, and explicit no-show actions after the five-minute grace period. Checked-in confirmed appointments may be marked Urgent only with an approved reason; returning to Normal requires a correction reason, and every change is transactionally appended to priority audit history. Staff receives only the approved limited record summary and cannot complete consultations or edit clinical content.
- **Admin:** provisions and activates/deactivates Doctor, Staff, and Patient portal accounts. Admin is not a clinical superuser and cannot edit medical records, Prescriptions, certificates, or Doctor decisions.

Backend authentication, active-account checks, role authorization, and resource ownership enforce these boundaries. Hidden buttons and frontend redirects are convenience controls, not the security boundary.

## Authentication and security model

- One `/login` route serves all roles; `/register` is Patient-only.
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
| Backend required | `MONGODB_URI`, `MONGODB_DB_NAME`, `NODE_ENV`, `CORS_ORIGIN`, `AUTH_SECRET`, `MFA_ENCRYPTION_KEY`, `CLINIC_NAME`, `CLINIC_LOCATION`, `CLINIC_TIME_ZONE` |
| Backend optional/configured when approved | `CLINIC_OPEN_TIME`, `CLINIC_CLOSE_TIME`, `CERTIFICATE_ISSUANCE_ENABLED`, `AUTH_LOGIN_RATE_LIMIT_WINDOW_MS`, `AUTH_LOGIN_RATE_LIMIT_MAX`, `AUTH_REGISTER_RATE_LIMIT_WINDOW_MS`, `AUTH_REGISTER_RATE_LIMIT_MAX`, `ADMIN_PROVISION_RATE_LIMIT_WINDOW_MS`, `ADMIN_PROVISION_RATE_LIMIT_MAX`, `MFA_VERIFY_RATE_LIMIT_WINDOW_MS`, `MFA_VERIFY_RATE_LIMIT_MAX` |
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
- email verification and password reset;
- email and SMS notifications;
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

For a new development session, begin with:

> Continue Arion Health Portal from the completed MVP baseline in `PROJECT_HANDOFF.md`. Read `AGENT.md`, `PROJECT_SPEC.md`, `SCHEMA.md`, `ERD.md`, `SITEMAP.md`, `README.md`, and `OPERATIONS_RUNBOOK.md`. Production is DEPLOYED + RESTRICTED and synthetic-only. Preview is isolated. Do not enable Production certificates, use real clinical data, change secrets/cloud resources, or implement backlog items without explicit scope and approval. Preserve 107 frontend, 242 backend, and 48 E2E baseline behavior and add tests for approved changes.

## Final classification

**Safe for:** school/demo presentation, synthetic workflow demonstrations, local development, protected Preview testing, and restricted Production smoke validation.

**Not authorized for:** real patient or clinical data, live clinic operations, clinical decision-making, certificate issuance in Production, claims of full disaster recovery or durable audit logging, or unrestricted public healthcare use.
