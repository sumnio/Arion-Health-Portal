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
- Supabase later
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
- Use mock data until instructed to connect Supabase.
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
- Protected routes require an authenticated user, an active account, and the permitted role. Frontend redirects are navigation behavior, not the security boundary; backend authorization and RLS must enforce access later.
- Mock role selection and “Exit mock preview” controls are temporary development behavior and must be removed when real authentication is implemented.

## Backend portability

- Use Supabase for the initial backend implementation.
- Keep database and backend access behind service modules or API abstractions.
- Do not call Supabase directly throughout UI components.
- Structure the code so Supabase can later be replaced by an Express + Node.js + MongoDB backend without rewriting the frontend.
- Keep frontend components independent from backend provider-specific logic.
