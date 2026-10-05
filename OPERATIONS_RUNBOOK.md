# Arion Health Portal Operations Runbook

This runbook covers the restricted, synthetic/demo-only Production deployment at `https://arion-health-portal.vercel.app`. It uses only Vercel Hobby and MongoDB Atlas Free capabilities. Do not enter or retain real patient or clinical data. Production medical-certificate issuance remains disabled until protected Doctor signature storage and authorized rendering are implemented.

## Current environment boundaries

- Production and Preview are separate Vercel deployments with separate database names and environment scopes.
- Production is **DEPLOYED + RESTRICTED**. Preview remains protected and isolated.
- Atlas Free has no managed backups or point-in-time recovery.
- Vercel Hobby runtime logs have short retention and no Log Drain. Treat logs as a live troubleshooting aid rather than an audit archive.
- Paid monitoring, SIEM, managed backup, and paid alerting are outside the current scope.

## Production health check

1. Open `https://arion-health-portal.vercel.app/api/health`.
2. Expect HTTP `200` and `{"status":"ok","service":"arion-health-api"}`.
3. Open the homepage and `/login`; confirm both load through HTTPS without a browser error.
4. For a deeper check, sign in with the permanent Admin account, complete TOTP MFA, confirm `/admin/dashboard` loads, then log out. Never record credentials, the TOTP seed, codes, cookies, or tokens.
5. If the health check fails, use the incident checklist before changing configuration or redeploying.

## Vercel logs and free monitoring

In the Vercel project, choose **Logs**, select the Production environment, set a short time range, and filter by route, status, or text. For a deployment-specific view, open **Deployments**, choose the Production deployment, then inspect its build and runtime logs. Runtime logs show Function invocations; Hobby retention is limited, so investigate promptly.

Security log lines are structured JSON. Useful event names include:

- `AUTH_LOGIN_FAILURE`, `AUTH_LOGIN_SUCCESS`, `AUTH_LOGOUT`
- `RATE_LIMIT_TRIGGERED`
- `AUTHZ_FORBIDDEN`
- MFA enrollment, challenge, verification, and denial events beginning with `MFA_` or `AUTH_MFA_`
- Admin provisioning and account lifecycle events for activation/deactivation

Safe fields to inspect are timestamp, event, severity, outcome, opaque actor/profile ID, role, target type, opaque target ID, route, method, resolved IP, and allowlisted non-sensitive metadata. Logs must never contain passwords or hashes, JWTs, cookies, authorization headers, connection strings, secret values, MFA seeds/codes/QR URIs/challenges, full names, contact details, addresses, dates of birth, request bodies, Doctor signature paths, diagnoses, notes, prescriptions, certificate contents, or other clinical narrative. If any appears, restrict access to the logs, preserve only the minimum incident evidence, rotate affected credentials, and fix the logging source.

Free/native checks:

- **Runtime errors and 5xx:** use Logs and filter to Production and error/5xx outcomes.
- **Build or deployment failures:** open Deployments and inspect the failed deployment's build log; enable the available Vercel deployment-failure notifications.
- **Request volume:** use the project's Usage/Observability views available on Hobby and runtime invocation logs.
- **Latency:** inspect the free overview when present and individual invocation duration in logs. Longer retention and advanced path-level latency analysis are plan-limited and deferred.
- **Availability:** run the manual health check. No paid synthetic monitor is configured.

Vercel notifications can be managed from account/project notification settings. Enable free email, web, or push notifications for failed deployments where available. Usage-threshold customization, longer retention, Log Drains, and advanced Observability are deferred if the dashboard marks them as paid.

## Atlas Free monitoring

In Atlas, open the Production project and cluster, then use **Metrics** and **Alerts**:

- confirm cluster status is available and healthy;
- review **Connections** and investigate unexpected growth against the Free-tier connection limit;
- review **Logical Size** for database/storage utilization;
- review **Network** for unusual ingress/egress changes;
- review **Opcounter** for unexpected operation spikes;
- read Atlas project/cluster warnings and activity notices.

Free clusters expose only a limited metrics and alert set and can pause monitoring after prolonged inactivity. Configure free Atlas alerts for supported Connections, Logical Size, Network, and Opscounter thresholds, plus available cluster/resource health notifications. Send alerts only to approved operator accounts and never include credentials or patient information in alert names or notes.

## Incident checklist

### A. Site unavailable

1. Check the latest Vercel Production deployment status.
2. Request `/api/health` and record only time, status, and non-sensitive error code.
3. Inspect recent Production runtime logs for errors/5xx.
4. Inspect the latest build/deployment log and compare with the previous known-good deployment.
5. Avoid repeated redeploys until the failing layer is identified.

### B. MongoDB unavailable

1. Inspect Atlas cluster status, Metrics, Alerts, and provider incidents.
2. Confirm the Production environment contains the required variable names and correct scopes without viewing or printing values.
3. Inspect runtime logs for sanitized connection failures.
4. Do not repeatedly redeploy or rotate database credentials blindly.

### C. Authentication failures

1. Inspect authentication, MFA, authorization, and rate-limit events.
2. Determine whether the shared limiter is rejecting abusive attempts; wait for the documented window rather than bypassing it.
3. Confirm `AUTH_SECRET` and `MFA_ENCRYPTION_KEY` were not changed and remain Production-scoped. Never reveal their values.
4. Confirm the account is active and the system clock used for TOTP is accurate.

### D. Admin MFA failure

1. Confirm `MFA_ENCRYPTION_KEY` is present and unchanged.
2. Check MFA challenge/verification events and rate-limit state.
3. Use the controlled offline recovery process with identity verification and audit notes.
4. Never edit encrypted MFA fields directly. Recovery codes remain unavailable.

### E. Suspected credential leak

1. Restrict access and identify the smallest affected credential set without copying secrets into tickets or chat.
2. Rotate the affected value in its authoritative secret store, redeploy if required, and validate health/authentication.
3. Rotating `AUTH_SECRET` invalidates active sessions.
4. Do not rotate `MFA_ENCRYPTION_KEY` casually: enrolled Admin MFA secrets depend on it and may become unreadable.
5. Rotate Atlas credentials if exposed and update only the intended environment scope.
6. Review logs/artifacts for exposure and document non-sensitive findings.

## Manual backup strategy

Atlas Free has no managed backup or point-in-time recovery. For this restricted demo environment, an approved operator may periodically run `mongodump` from a trusted machine using the helper at `server/scripts/backupProduction.ps1`.

Prerequisites:

- install the official MongoDB Database Tools;
- use a trusted, patched operator machine and trusted network;
- export `MONGODB_URI` and `MONGODB_DB_NAME=arion_health_production` only in the current process;
- set `BACKUP_OUTPUT_DIR` to an operator-controlled encrypted local or removable volume;
- ensure the destination is not synchronized to an unapproved cloud service;
- never use this process for real clinical data under the current restricted deployment.

Run manually from the repository root:

```powershell
powershell -NoProfile -File .\server\scripts\backupProduction.ps1 -ConfirmProductionBackup
```

The helper refuses an unconfirmed run, requires the exact Production database name, keeps the URI out of the displayed `mongodump` command by using a permission-restricted temporary config, removes that config, deletes a partial archive on failure, and writes a compressed archive only to the supplied encrypted location. It is not scheduled. The repository ignores `backups/`, `dumps/`, `*.archive`, and `*.archive.gz`, but an ignore rule is not encryption or access control.

Record the date, operator, archive filename, checksum, storage location, and non-sensitive outcome in the private operator log. Never record the URI or password. Keep only the approved retention set and securely delete expired copies. If local DNS, Atlas network access, Database Tools, or connectivity makes the dump unreliable, report that no verified backup exists; do not claim recovery coverage.

## Restore procedure and limitation

Never test a restore against Production. With an approved test archive, provision a disposable local/test database whose name clearly contains `restore_test`, use `mongorestore --archive=<archive> --gzip --nsFrom='arion_health_production.*' --nsTo='arion_health_restore_test.*'`, and provide credentials through a protected environment/config mechanism. Verify expected collection counts and a read-only application check, record the outcome, then delete the disposable database and temporary credentials. Do not create fake Production data merely to exercise restore.

Vercel rollback restores application deployment state; it does **not** restore MongoDB data. Atlas Free has no managed PITR, so database rollback remains an acknowledged limitation. A manual archive can recover only the state captured at its creation time.

## Application deployment rollback

1. In Vercel **Deployments**, identify the previous known-good Production deployment and inspect its source revision, build result, and configuration before acting.
2. Use Vercel's supported **Instant Rollback** or `vercel rollback` workflow. Hobby may limit rollback selection to the immediately previous Production deployment.
3. Do not assume a code rollback is database-compatible. Review migrations, model compatibility, and environment changes first.
4. After rollback, recheck `/api/health`, homepage/login, Admin MFA, role protection, CORS, and certificate restriction.
5. Monitor runtime errors and 5xx. If the known-good deployment is unsuitable, diagnose before promoting another deployment.

Do not perform a healthy-system rollback as a drill. A rollback does not recover external Atlas state and may retain current environment-variable values depending on the Vercel workflow; inspect the deployment before promotion.

## Secret recovery inventory

Keep recoverable copies in an approved password manager or offline secret vault outside Vercel and outside this repository:

- `AUTH_SECRET` — loss/change invalidates existing sessions;
- `MFA_ENCRYPTION_KEY` — loss/change can make enrolled Admin MFA secrets unreadable;
- Production Atlas connection credentials — rotate through Atlas if compromised;
- permanent Admin credentials and authenticator recovery custody information.

Never put actual values in documentation, Git, logs, support messages, screenshots, or backup filenames. Access should be limited to designated operators and periodically reviewed.

## Production environment-variable inventory

Required backend names: `MONGODB_URI`, `MONGODB_DB_NAME`, `NODE_ENV`, `CORS_ORIGIN`, `AUTH_SECRET`, `MFA_ENCRYPTION_KEY`, `CLINIC_NAME`, `CLINIC_LOCATION`, and `CLINIC_TIME_ZONE`. The frontend uses public `VITE_API_BASE_URL` (intentionally empty for same-origin Vercel requests) and `VITE_CERTIFICATE_ISSUANCE_ENABLED`. `CLINIC_OPEN_TIME` and `CLINIC_CLOSE_TIME` are optional and must be configured together once approved. `CERTIFICATE_ISSUANCE_ENABLED` and `VITE_CERTIFICATE_ISSUANCE_ENABLED` remain `false` in restricted Production.

Optional rate-limit overrides are `AUTH_LOGIN_RATE_LIMIT_WINDOW_MS`, `AUTH_LOGIN_RATE_LIMIT_MAX`, `AUTH_REGISTER_RATE_LIMIT_WINDOW_MS`, `AUTH_REGISTER_RATE_LIMIT_MAX`, `ADMIN_PROVISION_RATE_LIMIT_WINDOW_MS`, `ADMIN_PROVISION_RATE_LIMIT_MAX`, `MFA_VERIFY_RATE_LIMIT_WINDOW_MS`, and `MFA_VERIFY_RATE_LIMIT_MAX`. Temporary `ADMIN_*` bootstrap values must remain absent after the one-time bootstrap. Review names and scopes only; never download or print Production values.

## Operator checklist

Weekly:

- check Production `/api/health`, homepage, and login;
- review Vercel deployment status, runtime errors, 5xx, and recent failed builds;
- review Atlas cluster health, Connections, Logical Size, Network, Opcounter, and alerts;
- spot-check structured security logs for login failures, MFA denials, forbidden access, and rate-limit anomalies;
- confirm Production remains synthetic/demo-only and certificate issuance remains disabled.

Monthly:

- run frontend and backend dependency audits and review lockfile changes;
- verify the secret inventory, custody, Production scopes, and absence of temporary `ADMIN_*` values without exposing values;
- create a manual backup only when approved, store it on the encrypted destination, and record a checksum/outcome;
- review the disposable restore procedure and record whether a safe restore test is possible; do not use Production;
- review Vercel/Atlas notification recipients and operational access;
- confirm Preview and Production remain isolated and no real patient or clinical data is present.

## Milestone 25.7 validation record

On 2026-10-02, a controlled live smoke used exact `prod-smoke-*` synthetic identities to exercise the deployed Patient, Doctor, and Staff portals, representative account lifecycle and role/ownership controls, session refresh/logout, the shared login limiter, and certificate fail-closed behavior. The permanent Admin completed password-plus-TOTP login, loaded all account pages, survived refresh, and logged out successfully. Runtime logs contained the expected redacted authentication, MFA, logout, inactive-account, forbidden-access, and limiter events without credentials, tokens, connection strings, or clinical content.

Cleanup removed and verified the absence of all disposable identities and linked operational data by exact generated IDs. The post-cleanup Admin dashboard showed zero Doctors, zero Staff, and zero Patients; the permanent Admin remained active and MFA-enrolled. Production and Preview were both Ready and remained isolated to `arion_health_production` and `arion_health_preview`. Production certificate issuance remained disabled and no clinical record, Prescription, or certificate was created.

Use this as a point-in-time validation record, not continuous monitoring evidence. The free-tier retention, recovery, and alerting limitations elsewhere in this runbook still apply.

## Milestone 25.8 final operations handoff

The MVP and deployment milestones are complete. The Production environment remains **DEPLOYED + RESTRICTED** and synthetic/demo-only; Preview remains protected and isolated. `PROJECT_HANDOFF.md` contains the final architecture, role/security summary, environment-name inventory, restrictions, requirements before real clinical use, post-MVP workflow, and future-session prompt. This runbook remains the detailed source for operational actions.

Do not enable Production certificate issuance, enter real clinical data, claim managed backup/PITR or durable log retention, or change Production secrets/cloud resources as routine maintenance. Those actions require an approved post-MVP scope, risk review, and controlled validation. Keep the permanent Admin credentials, authenticator custody, `AUTH_SECRET`, `MFA_ENCRYPTION_KEY`, and Atlas credentials in approved external secure storage; keep temporary `ADMIN_*` variables absent.
