# Arion Health Portal

React, React Router, Vite, and Tailwind foundation with 27 approved routes and shared Patient, Doctor, Staff, and Admin layouts. Milestone 2 implements the landing, login, and patient registration pages; role pages remain placeholders.

## Run locally

Use Node.js 24 LTS and npm.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. On Login, enter a sample email and any non-empty sample password, select Patient, Doctor, Staff, or Admin under the mock preview role, and submit. Registration is patient-only, validates required fields, a non-future birth date, and matching passwords, then displays a mock completion message. Form values are not persisted or sent to a backend; no real account or authenticated session is created. Role pages remain accessible previews, not enforced access control.

All detail placeholders remain reachable through mock example links. Public pages follow the approved wireframe structure while omitting unapproved address storage, legal routes, social login, password recovery, and other wireframe-only features. Public styles are scoped to the public layout. Mock authentication behavior lives behind `src/services/authService.js`.

```sh
npm test
npm run build
npm run preview
```

## Structure

- `src/app`: approved route definitions, router, contextual navigation.
- `src/components`: reusable branding, navigation, and placeholder content.
- `src/layouts`: public layout and shared shell with four role-specific entry points.
- `src/pages`: role-specific placeholder page renderers; split into feature pages in future milestones.
- `src/services`: provider-independent boundary used by the UI.
- `src/mocks`: preview profiles and navigation IDs; imported only by services.
- `src/styles`: Tailwind entry and responsive layout styling.
- `scripts`: route coverage and navigation checks against the approved sitemap.

Future backend integrations belong behind services. No Supabase SDK or database calls are present. Services may later delegate to Supabase or an Express API without putting provider-specific access in UI components.

Source documents currently live at the repository root (`AGENT.md`, `PROJECT_SPEC.md`, `SCHEMA.md`, `ERD.md`, `SITEMAP.md`), with images in `wireframe/`. See `MILESTONE_1_NOTES.md` for discrepancies. Original approval documents are unchanged.

Production hosting will need an SPA fallback to `index.html` for direct route loads. Deployment is outside this milestone.
