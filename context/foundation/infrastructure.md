---
project: bmc-ai-advisor
researched_at: 2026-05-31
recommended_platform: Cloudflare Workers
runner_up: Netlify
context_type: mvp
tech_stack:
  language: TypeScript
  framework: Astro 6 + React 19
  runtime: Cloudflare Workers (workerd)
  auth_db: Supabase (external)
  ai_gateway: OpenRouter (openrouter.ai/api/v1) or OpenAI (api.openai.com/v1) — selected via AI_PROVIDER env var
---

## Recommendation

**Deploy on Cloudflare Workers.**

The project is already wired for this target — `@astrojs/cloudflare` v13 is configured, `npm run dev` runs under the real `workerd` runtime, and `wrangler` is the project's CLI. AI calls use an OpenAI-compatible SDK with two interchangeable backends: **OpenRouter** (`openrouter.ai/api/v1`) for multi-model testing, or **OpenAI directly** (`api.openai.com/v1`). Backend is selected via `AI_PROVIDER=openrouter|openai` env var — no code changes needed to switch. The free tier covers 100k requests/day with no monthly cost — matching the "minimize cost" constraint exactly. Familiarity with Cloudflare Workers/Pages was cited, and the platform scores 10/10 on all five agent-friendly criteria. One critical correction from research: `@astrojs/cloudflare` v13 dropped Cloudflare Pages support entirely — the deploy target is Workers, not Pages. `tech-stack.md` lists `deployment_target: cloudflare-pages`, which is now stale.

## Platform Comparison

Scored against the five agent-friendly criteria (Pass = 2 / Partial = 1 / Fail = 0). Hard filter (no persistent connections needed): all platforms pass.

| Platform | CLI-first | Managed/Serverless | Agent docs | Deploy API | MCP/Integration | Total |
|---|---|---|---|---|---|---|
| **Cloudflare Workers** | Pass | Pass | Pass | Pass | Pass | **10** |
| **Netlify** | Pass | Pass | Pass | Pass | Pass | **10** |
| **Vercel** | Pass | Pass | Partial | Pass | Pass | **9** |
| Railway | Pass | Partial | Partial | Pass | Pass | **8** |
| Fly.io | Pass | Partial | Fail | Pass | Partial | **7** |
| Render | Partial | Pass | Partial | Pass | Fail | **6** |

**Criteria notes:**
- Cloudflare: `llms.txt` confirmed at `developers.cloudflare.com/workers/llms.txt`; MCP via Cloudflare Agents SDK (presented as production-ready, no explicit GA label in docs as of 2026-05-31); `wrangler` CLI covers full operational loop.
- Netlify: `docs.netlify.com/llms.txt` confirmed; `@netlify/mcp` GA; `@astrojs/netlify` v6.1.0 GA — but requires adapter swap from Cloudflare.
- Vercel: MCP GA at `mcp.vercel.com`; no `llms.txt` published (docs accessible only through MCP search tool); adapter is GA; commercial use requires $20/mo Pro plan.
- Railway: MCP Server GA (Aug 2025); docs not available as markdown/llms.txt; no true `rollback` CLI subcommand; Hobby plan $5/mo; requires Node adapter swap.
- Fly.io: no `llms.txt`; flyctl MCP is preview/experimental; free tier removed Oct 2024 (card required); requires Node adapter swap + Dockerfile.
- Render: no CLI (deploy hooks only); no MCP; free tier spins down after 15 min with ~30s cold starts.

**Soft-weight effects:**
- "Minimize cost" → Cloudflare and Netlify win (free at MVP scale); Vercel requires $20/mo for commercial; Fly.io ~$4–10/mo; Railway $5/mo.
- "Cloudflare familiarity" → breaks the Cloudflare/Netlify tie at 10/10 in Cloudflare's favor.
- "Single region fine" → edge-global advantage is muted; does not penalize Cloudflare.
- "External providers fine" → no weight shift; Supabase works from any platform.

### Shortlisted Platforms

#### 1. Cloudflare Workers (Recommended)

Zero-cost at MVP scale (100k req/day free), perfect stack alignment — `@astrojs/cloudflare` v13 is already configured and `workerd` runs locally via `astro dev`. `wrangler` CLI covers deploy, rollback, log tailing, secrets, and staged rollouts in one tool. `llms.txt` published, Cloudflare MCP available. No adapter swap, no runtime change, no additional configuration beyond verifying `nodejs_compat` and correcting the deploy target from Pages to Workers.

#### 2. Netlify

Matches Cloudflare on agent-friendly score (10/10): `llms.txt` GA, `@netlify/mcp` GA, free tier covers 10k–100k requests. Strong Astro adapter (`@astrojs/netlify` v6.1.0 GA, `astro:env` secrets stabilized). Would require swapping `@astrojs/cloudflare` for `@astrojs/netlify` and removing `workerd`-specific config — a meaningful change mid-project. No CLI rollback command (dashboard-only).

#### 3. Vercel

Best-in-class DX, MCP GA, strong Astro SSR support (`@astrojs/vercel` v10.0.8). The blocking factor is cost: commercial/team use requires the Pro plan at $20/user/month. The Hobby (free) plan prohibits commercial use by Vercel's terms. Would also require adapter swap. Dropped to third purely on cost grounds against the stated priority.

## Anti-Bias Cross-Check: Cloudflare Workers

### Devil's Advocate — Weaknesses

1. **CPU quota, not wall-clock**: Workers bill CPU time. The free plan caps at 10ms CPU/invocation; the paid plan caps at 30ms (default; configurable up to 5 minutes). Astro SSR rendering + Zod validation of AI responses + Supabase cookie resolution can push against 10ms under load — silently, until HTTP 1015 errors appear.
2. **`nodejs_compat` is required, not default**: `@astrojs/cloudflare` requires `compatibility_flags = ["nodejs_compat"]` in `wrangler.jsonc` with `compatibility_date ≥ 2024-09-23`. Missing this causes cryptic runtime errors. Any npm package using `node:crypto`, `node:buffer`, or `node:stream` will fail without it.
3. **Bundle size cap**: 1 MB compressed on the free plan, 3 MB on the paid plan. React 19 + Astro islands + multiple shadcn/ui components can approach 1 MB. Verify with `wrangler deploy --dry-run` before first production push.
4. **Local dev divergence**: `astro dev` runs `workerd` locally (production-parity since adapter v13), but binding resolution, env var injection from `.dev.vars`, and Supabase cookie handling can still behave differently between local and production in edge cases.
5. **No log retention on free plan**: `wrangler tail` streams live logs only. Historical log access (Workers Logpush) is a paid feature. If you need to debug a past error, you must have set up external forwarding in advance.

### Pre-Mortem — How This Could Fail

The project deploys to Cloudflare Workers in week 1. Local dev passes. In production, the first demo shows intermittent HTTP 1015 errors under concurrent AI canvas generation requests — traced to synchronous Zod parsing of the Anthropic API response plus Astro's SSR template rendering exceeding the 10ms CPU quota on the free plan. Upgrading to the paid Workers plan ($5/month) resolves the CPU limit. In week 2, `wrangler deploy` fails with a bundle size error after several shadcn/ui components are added — the compressed bundle hit 1.1 MB. A tree-shaking audit costs half a day. In week 3, a subtle auth regression appears on share-link routes: recipients occasionally see a 403 from a Cloudflare Access rule that was inadvertently applied to the public `/share/[id]` route during a wrangler config edit. This was never visible locally because Cloudflare Access is a production-only layer. The root cause — all three issues — is the gap between local `workerd` simulation and the real production environment for edge-specific concerns.

### Unknown Unknowns

1. **Pages → Workers migration required**: `@astrojs/cloudflare` v13 removed Pages support. If any part of the scaffolding assumes `wrangler pages deploy` or Pages-specific config (`_routes.json`, `functions/` directory), those must be removed before first deploy. `tech-stack.md`'s `deployment_target: cloudflare-pages` reflects this legacy assumption.
2. **`.dev.vars` vs Workers secrets vs `astro:env/server`**: Three env var surfaces. `.dev.vars` is for `wrangler dev` only; Workers secrets are set with `wrangler secret put`; `astro:env/server` adds a schema-validation layer on top. A mismatch between these three — especially after renaming a variable — is the most common source of "works in dev, broken in prod."
3. **Supabase cookie API requirement**: `@supabase/ssr` in Workers requires the `getAll`/`setAll` cookie API pattern, not the older `get`/`set`/`remove` approach. Any modification to `src/lib/supabase.ts` or `src/middleware.ts` that uses the older pattern causes silent auth loops at the edge.
4. **Share-link route caching**: Cloudflare's edge may cache GET responses on public routes. Without explicit `Cache-Control: no-store` or a `Cache-Control: private` header on dynamic canvas routes (`/share/[id]`), a recipient could serve a stale or incorrect canvas — a direct PRD guardrail violation.
5. **CPU time vs wall-clock for AI calls**: Async Supabase and Anthropic API calls don't count toward CPU time (you're blocked on I/O), but synchronous JS — JSON parsing, Zod validation, template hydration — does. Large AI responses structured through a Zod schema can spike CPU time in ways invisible in local dev because `workerd` local does not enforce the 10ms quota.

## Operational Story

- **Preview deploys**: Use `wrangler versions upload` to create a staged version, then `wrangler versions deploy --percentage N` for a canary rollout. Alternatively, use separate named environments in `wrangler.jsonc` (e.g., `[env.staging]`). Preview URLs are generated per version. No built-in branch-preview UI like Vercel/Netlify — you manage named environments yourself.
- **Secrets**: Production secrets are stored in Workers Secrets via `wrangler secret put KEY`. Local dev uses `.dev.vars` (gitignored). `astro:env/server` reads from either surface at runtime. Required keys: `SUPABASE_URL`, `SUPABASE_KEY`, `AI_PROVIDER` (`openrouter` or `openai`), and either `OPENROUTER_API_KEY` or `OPENAI_API_KEY` depending on the chosen provider. Secrets are encrypted at rest; only the wrangler-authenticated account owner can list or update them.
- **Rollback**: `wrangler rollback [VERSION_ID]` — creates a new deployment pointing to the prior version. Executes in seconds. DB migrations (Supabase) do not roll back automatically — always make schema changes backward-compatible before deploying.
- **Approval**: Wrangler authentication (`wrangler login`) is required for any deploy or secret operation. An agent may perform `wrangler deploy`, `wrangler secret put`, and `wrangler tail` unattended once authenticated. Dropping a Supabase database or rotating the primary Supabase key requires a human.
- **Logs**: `wrangler tail [WORKER] --format pretty` streams live request logs. Add `--status error` to filter errors only, `--search "keyword"` for targeted queries. No historical retention on the free plan — set up Workers Logpush (paid) or forward to an external sink (e.g., Baselime, Axiom) before going to production.

## Risk Register

| Risk | Source | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| CPU quota exceeded (HTTP 1015) on free plan under AI-heavy SSR | Devil's advocate | M | H | Profile CPU-heavy paths with `wrangler dev --local`; upgrade to paid plan ($5/mo) before launch; move Zod validation of AI responses to streaming/async patterns where possible |
| Bundle size exceeds 1 MB compressed (free plan limit) | Devil's advocate | M | H | Run `wrangler deploy --dry-run` after each batch of new dependencies; remove unused shadcn/ui components; verify tree-shaking config |
| `nodejs_compat` missing or misconfigured | Unknown unknown | M | H | Add `compatibility_flags = ["nodejs_compat"]` and `compatibility_date = "2024-09-23"` to `wrangler.jsonc` as the first setup step; CI build catches this via `wrangler deploy --dry-run` |
| Share-link routes cached at edge expose wrong canvas | Unknown unknown | M | H | Add `Cache-Control: no-store` to all `/share/[id]` responses; test with `curl -I` against production URL before demo |
| Auth loop on share-link routes due to `@supabase/ssr` cookie API | Pre-mortem | M | H | Audit `src/lib/supabase.ts` to confirm `getAll`/`setAll` pattern is used; add an integration smoke test for unauthenticated share-link access |
| `.dev.vars` / Workers secrets mismatch breaks production | Unknown unknown | M | M | Maintain a `env.example` (committed) that mirrors every key in Workers Secrets — including `AI_PROVIDER` and both `OPENROUTER_API_KEY` / `OPENAI_API_KEY`; run `wrangler secret list` as part of deploy checklist |
| Pages config artifacts cause deploy failure | Unknown unknown | L | M | Remove any `_routes.json`, `functions/` directory, or `wrangler pages` references before first deploy; `tech-stack.md` `deployment_target: cloudflare-pages` is stale — update to `cloudflare-workers` |
| No log retention on free plan masks production errors | Devil's advocate | H | M | Set up Workers Logpush to an external sink (e.g., Baselime free tier) before first production user; alternatively accept risk and upgrade to paid when needed |
| Local dev / production divergence for edge-specific behavior | Pre-mortem | L | M | Test all auth flows and share-link routes against a staging Workers environment (named env in `wrangler.jsonc`), not just local `workerd` |

## Getting Started

1. **Verify `wrangler.jsonc` targets Workers, not Pages**: Ensure there is no `wrangler pages` config. The file must have a `name` property and `compatibility_flags = ["nodejs_compat"]` with `compatibility_date = "2024-09-23"` (or later).
2. **Set local secrets**: Copy `.env.example` to `.dev.vars` and fill `SUPABASE_URL`, `SUPABASE_KEY`, and `OPENROUTER_API_KEY`. This file is already gitignored.
3. **Authenticate wrangler**: `npx wrangler login` — opens a browser OAuth flow. Run once per machine.
4. **Set production secrets**: `npx wrangler secret put SUPABASE_URL`, `npx wrangler secret put SUPABASE_KEY`, `npx wrangler secret put AI_PROVIDER` (value: `openrouter` or `openai`), and either `npx wrangler secret put OPENROUTER_API_KEY` or `npx wrangler secret put OPENAI_API_KEY`.
5. **Deploy**: `npm run build && npx wrangler deploy` — or use the project's `npm run build` followed by `npx wrangler deploy`. The adapter produces a Workers-compatible bundle in `dist/`.

## Out of Scope

The following were not evaluated in this research:
- Docker image configuration
- CI/CD pipeline setup (GitHub Actions wiring for auto-deploy)
- Production-scale architecture (multi-region, HA, DR)
- Cloudflare Access or zero-trust policies for preview environments
