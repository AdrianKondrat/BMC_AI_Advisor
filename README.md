# BMC AI Advisor

First-time founders stare at 9 empty Business Model Canvas boxes with no guidance — they either guess or abandon the exercise. Generic AI tools can fill the boxes on demand, but they return free-form text with no understanding of how the blocks relate, and nothing to share.

BMC AI Advisor closes that gap: describe your idea in plain text, get a structured 9-block canvas back, receive AI critique of how the blocks hold together, edit any block, and share a read-only link — all in one continuous session, no external help needed.

## What it does

- **AI-generated canvas** — a plain-text idea becomes a Business Model Canvas with all 9 blocks filled (Value Proposition, Customer Segments, Revenue Streams, etc.), structured rather than free-form
- **Block-level critique** — trigger an AI pass that checks cross-block consistency and surfaces feedback per block
- **Canvas dashboard** — view, edit, and delete saved canvases; edits auto-save
- **Shareable read-only links** — generate a share link with optional expiry; recipients can view but never modify the canvas
- **Account deletion** — permanently delete an account and all associated data

See [`context/foundation/roadmap.md`](context/foundation/roadmap.md) for the full feature status and what's still in progress.

## Tech stack

- [Astro](https://astro.build/) v6 — server-side-rendered app framework (`output: "server"`, deployed as Workers, not static)
- [React](https://react.dev/) v19 — interactive islands (canvas editor, critique panel, auth forms)
- [TypeScript](https://www.typescriptlang.org/) v5 — end to end
- [Tailwind CSS](https://tailwindcss.com/) v4 + [shadcn/ui](https://ui.shadcn.com/) ("new-york" variant) — styling and components
- [Supabase](https://supabase.com/) — auth (cookie-based SSR sessions) and Postgres with row-level security for per-user data isolation
- [OpenRouter](https://openrouter.ai/) — AI provider for canvas generation and critique
- [Cloudflare Workers](https://workers.cloudflare.com/) — edge deployment runtime, via `@astrojs/cloudflare`

## Prerequisites

- Node.js v22.14.0 (see `.nvmrc`)
- npm (comes with Node.js)
- [Docker](https://www.docker.com/) — only if running Supabase locally (~7 GB RAM)

## Getting started

1. Clone the repository and install dependencies:

```bash
git clone <repo-url>
cd Project
npm install
```

2. Set up Supabase and your environment variables — see [Local setup — Supabase](#local-setup--supabase) below.
3. Set up Cloudflare local dev secrets — see [Local setup — Cloudflare](#local-setup--cloudflare) below.
4. Start the dev server:

```bash
npm run dev
```

## Local setup — Supabase

This project uses [Supabase](https://supabase.com/) for authentication. Env vars are declared via Astro's `astro:env` schema (`astro.config.mjs`) and treated as **server-only secrets** — never exposed to the client.

### Option A: local Supabase (no cloud project needed)

Requires Docker.

1. Create your `.env` file:

```bash
cp .env.example .env
```

2. Initialize and start the local stack (downloads Docker images on first run):

```bash
npx supabase init
npx supabase start
```

3. Copy the credentials the CLI prints into `.env` and `.dev.vars`:

```
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_KEY=<anon key from CLI output>
```

4. Stop the stack when done:

```bash
npx supabase stop
```

The local Studio UI is available at `http://localhost:54323`. No migrations are required to get started — Supabase Auth's built-in `auth.users` table is enough for sign-in/sign-up; canvas data uses the `canvases` and `share_links` tables under `supabase/migrations/`.

### Option B: hosted Supabase project

Add these to `.env` and `.dev.vars`:

| Variable       | Description       | Where to find it                    |
| -------------- | ----------------- | ----------------------------------- |
| `SUPABASE_URL` | Project URL       | Supabase dashboard → Settings → API |
| `SUPABASE_KEY` | `anon` public key | Supabase dashboard → Settings → API |

**Do not use the `service_role` key here** — it bypasses RLS. `SUPABASE_SERVICE_ROLE_KEY` is only needed server-side for the account-deletion endpoint (see below).

### Troubleshooting

- **Email confirmation blocking sign-in locally**: Supabase requires email confirmation by default. In the dashboard, go to **Authentication → Email → Confirm email** and toggle it off to sign in immediately after sign-up.
- **`npx supabase start` hangs or fails**: confirm Docker is running and has enough memory allocated (~7 GB); `npx supabase stop` then retry.
- **RLS errors on writes that should succeed**: confirm the SSR client is attaching the session JWT — see `src/lib/supabase.ts` and `context/foundation/lessons.md` for a known pitfall here.

### Auth routes

| Route                 | Description                                                       |
| --------------------- | ----------------------------------------------------------------- |
| `/auth/signin`        | Email/password sign-in form                                       |
| `/auth/signup`        | Email/password sign-up form                                       |
| `/auth/confirm-email` | Post-signup "check your inbox" page                               |
| `/dashboard`          | Canvas dashboard (redirects to `/auth/signin` if unauthenticated) |

Route protection is handled in `src/middleware.ts`; add paths to `PROTECTED_ROUTES` there to require authentication.

## Local setup — Cloudflare

The app runs on the Cloudflare `workerd` runtime even in dev (`npm run dev`), so secrets also need to exist in `.dev.vars`:

```bash
cp .env.example .dev.vars
```

Fill in the same values as `.env` (`SUPABASE_URL`, `SUPABASE_KEY`, and, for AI features, `AI_PROVIDER` + `OPENROUTER_API_KEY`).

## AI provider setup

Canvas generation and critique call OpenRouter. Set these in `.env` and `.dev.vars`:

```
AI_PROVIDER=openrouter
OPENROUTER_API_KEY=<your OpenRouter API key>
```

Without a key, auth, dashboard, and sharing still work, but canvas generation and critique will fail.

## Available scripts

- `npm run dev` — start dev server (Cloudflare `workerd` runtime)
- `npm run build` — production build (SSR via `@astrojs/cloudflare`)
- `npm run preview` — preview production build
- `npm run lint` — ESLint with type-checked rules
- `npm run lint:fix` — auto-fix lint issues
- `npm run format` — Prettier (includes prettier-plugin-astro + prettier-plugin-tailwindcss)
- `npm test` — run the Vitest suite once
- `npm run test:watch` — Vitest in watch mode

## Project structure

```
.
├── src/
│   ├── components/       # Astro & React components (ui/, auth/, account/)
│   ├── layouts/          # Astro layouts
│   ├── lib/              # Supabase client, services, helpers
│   ├── pages/
│   │   ├── api/          # API routes (auth, canvases, share)
│   │   ├── auth/         # Sign in / sign up / confirm email
│   │   ├── canvas/       # Canvas editor
│   │   └── share/        # Public read-only share view
│   └── middleware.ts     # Auth resolution + protected-route redirects
├── supabase/
│   └── migrations/       # Schema: canvases, share_links, RLS policies
├── public/               # Static assets
├── wrangler.jsonc        # Cloudflare Workers config
```

## Deployment

Deploys to Cloudflare Workers.

1. Build:

```bash
npm run build
```

2. Deploy:

```bash
npx wrangler deploy
```

Set `SUPABASE_URL`, `SUPABASE_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` (needed for account deletion) as Cloudflare secrets via `npx wrangler secret put <NAME>` or the Cloudflare dashboard.

### CI

`.github/workflows/ci.yml` runs lint, build, and tests on every push and PR to `main`, and deploys via `wrangler deploy` on push to `main`. Configure `SUPABASE_URL` and `SUPABASE_KEY` as repository secrets for the build step.

## Context & quality docs

- [`context/foundation/roadmap.md`](context/foundation/roadmap.md) — feature status, what's shipped vs. planned
- [`context/foundation/prd.md`](context/foundation/prd.md) — product requirements and success criteria
- [`context/foundation/architecture.md`](context/foundation/architecture.md) — system design, failure risks, and how each is tested
- [`context/foundation/test-plan.md`](context/foundation/test-plan.md) — test strategy, risk map, and quality gates
- [`context/foundation/lessons.md`](context/foundation/lessons.md) — recurring pitfalls and how the codebase guards against them

## License

MIT
