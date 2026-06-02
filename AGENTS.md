# Repository Guidelines

Astro 6 SSR starter with React 19 islands, Tailwind 4, Supabase auth, and Cloudflare Workers deployment. See `@CLAUDE.md` for extended architecture notes.

## Hard Rules

- Use `cn()` from `@/lib/utils` for all Tailwind class merging — never concatenate class strings manually.
- Every new Supabase table must enable RLS with granular per-operation, per-role policies in `supabase/migrations/`.
- All pages are server-rendered by default. API routes must export `const prerender = false`.
- Use Astro components for static content/layout; use React only when interactivity is required.
- No Next.js-style directives (`"use client"`, etc.) in React components.
- API route handlers export uppercase named functions (`GET`, `POST`); validate all input with zod.

## Project Structure

- `src/components/` — Astro + React components; `ui/` = shadcn/ui (new-york style), `auth/` = auth forms, `hooks/` = React hooks
- `src/pages/` — All routes; `api/` = API endpoints, `auth/` = auth pages
- `src/lib/` — Utilities; `lib/services/` for extracted business logic
- `src/middleware.ts` — Attaches user to `context.locals.user`, enforces `PROTECTED_ROUTES`
- `src/types.ts` — Shared entity and DTO types
- `supabase/migrations/` — SQL migrations; naming: `YYYYMMDDHHmmss_short_description.sql`

## Commands

- `npm run dev` — start dev server (Cloudflare workerd runtime)
- `npm run build` — production build (SSR via `@astrojs/cloudflare`)
- `npm run lint` / `npm run lint:fix` — ESLint with type-checked rules
- `npm run format` — Prettier (astro + tailwindcss plugins)

CI runs `lint` then `build` on every push and PR to `main`. Requires `SUPABASE_URL` and `SUPABASE_KEY` secrets.

## Coding Style & Naming

- Path alias `@/*` → `src/*`; use it consistently instead of relative paths that cross directory boundaries.
- Install new shadcn/ui components with `npx shadcn@latest add [name]`; they land in `src/components/ui/`.
- Shared types (entities, DTOs) go in `src/types.ts`; React hooks go in `src/components/hooks/`.
- ESLint enforces `typescript-eslint/strictTypeChecked`; Prettier print width is 120.

## Testing

No test framework is configured; no test scripts or CI test step exist.

## Commit & PR Guidelines

No commit convention established (single "initial commit" in history). CI gate: lint + build must pass before merging.

## Security & Configuration

- Copy `.env.example` → `.env` for Node, or `.dev.vars` for Cloudflare local dev (`.dev.vars` is gitignored).
- Required vars: `SUPABASE_URL`, `SUPABASE_KEY`, `ANTHROPIC_API_KEY`.
- Deploy via `npx wrangler deploy`; set production secrets with `wrangler secret put`.
