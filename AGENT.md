# Arion Health Portal

## Source of truth

Always read:
- PROJECT_SPEC.md
- SCHEMA.md
- ERD.md
- SITEMAP.md
- wireframe/

## Stack

- React
- Tailwind CSS
- React Router
- Backend: Express + Node.js + MongoDB (foundation established under `server/`)
- Vercel

## Roles

- Patient
- Doctor
- Staff
- Admin

## Rules

- Do not invent features.
- Do not change approved routes without permission.
- Do not change the approved schema without permission.
- Use mock data until instructed to connect the selected backend.
- Keep components reusable.
- Avoid duplicated code.
- Keep backend logic outside UI components.
- Do not expose secrets in frontend code.
- Keep role-based access in mind.
- Implement only the requested milestone.

## Authentication rules

- `/login` is the one shared login route for Patient, Doctor, Staff, and Admin.
- `/register` is Patient self-registration only. Doctor and Staff accounts are Admin-provisioned; Admin accounts are provisioned separately.
- Real authentication must not ask the user to select a role. Role comes from the trusted UserProfile linked to the authenticated user.
- Protected routes require an authenticated user, an active account, and the permitted role. Frontend redirects are navigation behavior, not the security boundary; backend authorization and database access controls must enforce access later. Use RLS when the selected provider supports it.
- Mock role selection and “Exit mock preview” controls are temporary development behavior and must be removed when the frontend is intentionally migrated to backend authentication.

## Backend portability

- The selected backend direction is Express + Node.js + MongoDB.
- Keep database and backend access behind service modules or API abstractions.
- Do not call a database, Supabase, or another provider directly throughout UI components.
- Keep the frontend service boundary independent from Express implementation details so feature services can migrate incrementally.
- Keep frontend components independent from backend provider-specific logic.
