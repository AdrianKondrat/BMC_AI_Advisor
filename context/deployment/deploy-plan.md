---
project: bmc-ai-advisor
deployed_at: 2026-06-02
platform: Cloudflare Workers
worker_name: bmc-ai-advisor
ai_provider: openrouter
context_type: deployment
---

## Deploy Target

**Platform:** Cloudflare Workers (free tier)
**Worker name:** `bmc-ai-advisor`
**Live URL:** `https://bmc-ai-advisor.<your-subdomain>.workers.dev`
**Adapter:** `@astrojs/cloudflare` v13+
**Runtime config:** `nodejs_compat`, `compatibility_date: 2026-05-08`

---

## Phase 0 — Local pre-flight

Verify everything is green before touching any remote service.

### 0.1 Node version

```bash
node -v   # must print v22.x.x
```

If not: `nvm use` (uses `.nvmrc`) or install Node 22 via nvm.

### 0.2 Dependencies

```bash
npm ci
```

Must complete with no errors. If `package-lock.json` is out of sync, run `npm install` first, then re-check.

### 0.3 Code quality gate

```bash
npx astro sync
npm run lint
npm run build
```

All three must pass cleanly. Fix any lint or type errors before proceeding — CI will block on the same checks.

**Expected output of `npm run build`:** a `dist/` directory containing a Workers-compatible bundle.

### 0.4 Verify `wrangler.jsonc` targets Workers (not Pages)

Open `wrangler.jsonc` and confirm all of the following are present:

```jsonc
{
  "name": "bmc-ai-advisor",
  "main": "@astrojs/cloudflare/entrypoints/server",
  "compatibility_date": "2026-05-08",      // any date >= 2024-09-23
  "compatibility_flags": ["nodejs_compat"],
  "assets": {
    "binding": "ASSETS",
    "directory": "./dist",
    "not_found_handling": "404-page"
  }
}
```

**Must NOT contain:** `wrangler pages`, `_routes.json`, `functions/` directory references. These are Pages artifacts and will break a Workers deploy.

### 0.5 Verify `.env.example` has all required keys

```bash
cat .env.example
```

Must list: `SUPABASE_URL`, `SUPABASE_KEY`, `AI_PROVIDER`, `OPENROUTER_API_KEY` (and/or `OPENAI_API_KEY`).

Gate: **do not proceed to Phase 1 until all 0.x checks are green.**

---

## Phase 1 — Wrangler CLI setup

One-time setup per machine.

### 1.1 Install / verify wrangler

```bash
npx wrangler --version
```

Expected: `4.x.x` or higher (ships with the project as a dev dependency — no global install needed).

### 1.2 Authenticate

```bash
npx wrangler login
```

This opens a browser OAuth flow. Log in with the Cloudflare account that will own the Worker. After login:

```bash
npx wrangler whoami
```

Must print your Cloudflare account name and email. If it shows "not authenticated", re-run `wrangler login`.

### 1.3 Retrieve your Account ID

```bash
npx wrangler whoami
```

Copy the **Account ID** from the output. You will need it in Phase 5 (GitHub secrets).

Alternatively: Cloudflare dashboard → top-right account menu → copy Account ID.

Gate: **`wrangler whoami` must succeed before Phase 2.**

---

## Phase 2 — Supabase project verification

### 2.1 Confirm you have a Supabase project

Go to [supabase.com/dashboard](https://supabase.com/dashboard). You need an existing project — this plan does not create one.

If you don't have a project yet:
1. Click **New project**.
2. Choose a region close to your users (Europe for Polish market).
3. Set a strong DB password and save it somewhere safe.
4. Wait ~2 minutes for the project to provision.

### 2.2 Get your Supabase credentials

Inside your Supabase project → **Settings → API**:

| Key | Where | Example |
|---|---|---|
| `SUPABASE_URL` | Project URL | `https://xyzabc.supabase.co` |
| `SUPABASE_KEY` | `anon` / `public` key | `eyJhbGci...` |

Copy both. The `anon` key is safe to use from server-side SSR — it is scoped by RLS policies.

**Do NOT use the `service_role` key** — it bypasses RLS entirely.

### 2.3 Verify your schema is up to date

```bash
npx supabase status     # confirm local Supabase is running (optional, for local dev only)
```

If you have pending migrations in `supabase/migrations/`, apply them to the **remote** project before deploying:

```bash
npx supabase db push
```

This requires `supabase link` (see 2.4). If no migrations exist yet, skip this step.

### 2.4 Link local project to remote Supabase (optional but recommended)

```bash
npx supabase login        # browser OAuth
npx supabase link --project-ref <your-project-ref>
```

Project ref is the string in your Supabase project URL: `https://supabase.com/dashboard/project/<project-ref>`.

Gate: **You must have `SUPABASE_URL` and `SUPABASE_KEY` in hand before Phase 3.**

---

## Phase 3 — Set Workers Secrets (production environment)

Secrets are encrypted at rest and injected as env vars at runtime. They are **not** stored in `wrangler.jsonc`.

Run each command and paste the value when prompted (the terminal will not echo it):

```bash
npx wrangler secret put SUPABASE_URL
# paste: https://xyzabc.supabase.co

npx wrangler secret put SUPABASE_KEY
# paste: eyJhbGci...

npx wrangler secret put AI_PROVIDER
# paste: openrouter  (or: openai)

npx wrangler secret put OPENROUTER_API_KEY
# paste: sk-or-...
# (if using openai instead: npx wrangler secret put OPENAI_API_KEY)
```

### 3.1 Verify secrets are registered

```bash
npx wrangler secret list
```

Expected output — all four keys listed (values are redacted):

```
SUPABASE_URL
SUPABASE_KEY
AI_PROVIDER
OPENROUTER_API_KEY
```

If any are missing, re-run the corresponding `wrangler secret put` command.

### 3.2 Cross-check against `.env.example`

Every key in `.env.example` must appear in `wrangler secret list`. Run:

```bash
grep -E '^[A-Z_]+=' .env.example
```

Compare the variable names to `wrangler secret list`. Gaps = runtime 500 errors in production.

Gate: **All secrets from `.env.example` must appear in `wrangler secret list` before Phase 4.**

---

## Phase 4 — Dry-run deploy (bundle size check)

Before any live deploy, verify the bundle fits within the free plan's 1 MB compressed limit.

```bash
npm run build && npx wrangler deploy --dry-run
```

### 4.1 Interpret the output

- **No errors + bundle size < 1 MB**: proceed to Phase 5.
- **Bundle size > 1 MB**: see mitigation below.
- **`nodejs_compat` errors**: check `wrangler.jsonc` (Phase 0.4).
- **Missing module errors**: a package is using a Node built-in without the compat flag — ensure `compatibility_flags: ["nodejs_compat"]` is set.

### 4.2 If bundle > 1 MB

1. Run `npx wrangler deploy --dry-run 2>&1 | grep "compressed"` to see exact size.
2. Audit large dependencies: `npx vite-bundle-visualizer` or check `dist/` sizes manually.
3. Remove unused shadcn/ui components: every unimported component still tree-shakes, but verify with `npm run build -- --minify`.
4. Do not proceed to Phase 5 until the dry-run passes cleanly.

---

## Phase 5 — First live deploy

```bash
npm run build && npx wrangler deploy
```

### 5.1 Expected output

```
Total Upload: ~XXX KiB / gzip: ~YYY KiB
Worker Startup Time: XX ms
Deployed bmc-ai-advisor triggers:
  https://bmc-ai-advisor.<your-subdomain>.workers.dev
```

Copy the `.workers.dev` URL — this is your production URL.

### 5.2 If the deploy fails

| Error | Fix |
|---|---|
| `Authentication error` | Re-run `npx wrangler login` |
| `Script startup exceeded CPU limit` | Check for top-level `await` outside request handlers |
| `Missing binding ASSETS` | Confirm `assets.directory = "./dist"` in `wrangler.jsonc` and that `npm run build` ran first |
| `Module not found: node:...` | Add `"nodejs_compat"` to `compatibility_flags` |
| `Bundle too large` | See Phase 4.2 |

---

## Phase 6 — Smoke testing

Run every check against the live `.workers.dev` URL immediately after first deploy.

### 6.1 HTTP checks

```bash
# Root must return 200
curl -s -o /dev/null -w "%{http_code}" https://bmc-ai-advisor.<subdomain>.workers.dev/
# Expected: 200

# Non-existent route must return 404 (not 500)
curl -s -o /dev/null -w "%{http_code}" https://bmc-ai-advisor.<subdomain>.workers.dev/does-not-exist
# Expected: 404
```

### 6.2 Auth flow checks

Open the URL in an incognito browser window and verify each step:

- [ ] `/auth/signup` — sign up with a new email, confirm the redirect to `/auth/confirm-email`
- [ ] Check email inbox for confirmation link, click it, confirm redirect to `/dashboard`
- [ ] Sign out, then `/auth/signin` — sign in with the same credentials, confirm redirect to `/dashboard`
- [ ] Reload `/dashboard` — session must persist (no redirect to sign-in)
- [ ] Navigate to a protected route without signing in — must redirect to `/auth/signin`

### 6.3 Live log check

Open a second terminal during smoke testing and stream live logs:

```bash
npx wrangler tail bmc-ai-advisor --format pretty
```

Watch for any unhandled exceptions or 500 errors during the auth flow. If you see errors, the log shows the stack trace. Ctrl+C to stop.

### 6.4 AI feature check (if wired up)

Test one AI-triggered action (e.g., canvas generation). Confirm:
- [ ] Response returns within ~10 seconds
- [ ] No HTTP 1015 errors in `wrangler tail` (CPU quota exceeded)
- [ ] Response content is valid (not an error JSON)

Gate: **All smoke test checks must pass before wiring up CI in Phase 7.**

---

## Phase 7 — GitHub Actions CI/CD wiring

This enables auto-deploy on every push to `main`.

### 7.1 Create a scoped Cloudflare API token

Go to [dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens):

1. Click **Create Token**.
2. Use the **Edit Cloudflare Workers** template (or create a custom token with the permissions below).

Minimum required permissions for the token:
- `Account → Cloudflare Workers Scripts → Edit`
- `Zone → Workers Routes → Edit` (only if using a custom domain)

**Do NOT use your Global API Key** — it grants full account access.

3. Set **Account Resources** to your specific account (not "All accounts").
4. Set **IP Address Filtering** if you want to lock to GitHub Actions IP ranges (optional but recommended).
5. Copy the token — it is shown only once.

### 7.2 Add GitHub repository secrets

Go to your GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret name | Value |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Token from step 7.1 |
| `CLOUDFLARE_ACCOUNT_ID` | Account ID from Phase 1.3 |
| `SUPABASE_URL` | Same value as Workers secret |
| `SUPABASE_KEY` | Same value as Workers secret |

`SUPABASE_URL` and `SUPABASE_KEY` are needed by the **build step** (not the deploy step) because Astro's `astro:env` schema validates them at build time.

### 7.3 Verify the CI workflow

The workflow at `.github/workflows/ci.yml` already contains a deploy step:

```yaml
- name: Deploy to Cloudflare Workers
  if: github.event_name == 'push'
  run: npx wrangler deploy
  env:
    CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
    CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

This step runs on `push` to `main` only — not on PRs. No changes needed.

### 7.4 Trigger a test CI run

```bash
git add .
git commit -m "chore: trigger first CI deploy"
git push origin main
```

Go to **GitHub → Actions** tab and watch the `CI` workflow run. Confirm:
- [ ] `npm run lint` passes
- [ ] `npm run build` passes
- [ ] `Deploy to Cloudflare Workers` step completes with exit code 0

If the deploy step fails: check that all four GitHub secrets are set (7.2) and that the token has the correct permissions (7.1).

---

## Phase 8 — Post-deploy hardening

### 8.1 Cache-Control on share-link routes

If the app has public `/share/[id]` routes, add an explicit header to prevent Cloudflare edge caching:

```typescript
// In the route handler
return new Response(html, {
  headers: {
    "Content-Type": "text/html",
    "Cache-Control": "no-store",
  },
});
```

Verify with:
```bash
curl -I https://bmc-ai-advisor.<subdomain>.workers.dev/share/test-id | grep cache-control
# Expected: cache-control: no-store
```

### 8.2 CPU quota awareness

If HTTP 1015 errors appear in `wrangler tail`:

1. Upgrade to the Workers Paid plan ($5/mo): dashboard → Workers → Plans → Upgrade.
2. This raises the CPU limit from 10ms to 30ms per invocation.
3. For heavy Zod parsing of AI responses, consider moving validation to streaming/incremental patterns.

### 8.3 Log retention (optional but recommended before first real user)

Free plan has no log history. Set up a free external sink before acquiring users:

- [Baselime](https://baselime.io) — free tier, native Workers Logpush integration
- Axiom — free up to 0.5 GB/day

Configure via: Cloudflare dashboard → Workers → your worker → Logpush → Add destination.

---

## Rollback

```bash
# List recent versions
npx wrangler versions list

# Roll back to a specific version (creates a new deployment pointing at the old code)
npx wrangler rollback [VERSION_ID]
```

Rollback takes effect in seconds. **DB schema changes (Supabase) do NOT roll back automatically.** Always make schema changes backward-compatible before deploying app code that depends on them.

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Bundle > 1 MB (free plan limit) | M | H | Dry-run in Phase 4 catches this before live deploy |
| CPU quota exceeded (HTTP 1015) under AI-heavy SSR | M | H | Monitor via `wrangler tail`; upgrade to paid ($5/mo) if errors appear |
| `nodejs_compat` missing → cryptic runtime errors | M | H | Verified in Phase 0.4; `nodejs_compat` is already in `wrangler.jsonc` |
| `.dev.vars` / Workers secrets mismatch | M | M | Phase 3.2 cross-check catches gaps before deploy |
| Share-link routes cached at edge | M | H | Phase 8.1 adds `Cache-Control: no-store` |
| Supabase `@supabase/ssr` cookie API regression | M | H | Auth smoke tests in Phase 6.2 catch this immediately after deploy |
| Pages config artifacts break Workers deploy | L | M | Phase 0.4 removes any stale Pages config before deploy |
| No log retention masks production errors | H | M | Phase 8.3 sets up external Logpush before first real user |
| CI deploy token too permissive | M | M | Phase 7.1 creates a scoped token limited to Workers Scripts on one account |
