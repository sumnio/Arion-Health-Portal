# Arion Health Portal

## Source of truth

Always read:
- docs/PROJECT_SPEC.md
- docs/SCHEMA.md
- docs/ERD.md
- docs/SITEMAP.md
- docs/wireframes/

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

## Backend portability

- Use Supabase for the initial backend implementation.
- Keep database and backend access behind service modules or API abstractions.
- Do not call Supabase directly throughout UI components.
- Structure the code so Supabase can later be replaced by an Express + Node.js + MongoDB backend without rewriting the frontend.
- Keep frontend components independent from backend provider-specific logic.