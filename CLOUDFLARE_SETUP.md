# Cloudflare Setup & Deployment Guide

## Overview

This project is deployed to Cloudflare Workers using Astro SSR with the `@astrojs/cloudflare` adapter. The guide covers authentication, environment configuration, and production deployment.

## Status

✅ **Wrangler CLI**: Installed (`npx wrangler 4.95.0`)
✅ **Authentication**: Logged in as `kondrat.adrian@gmail.com`
✅ **Account**: `Kondrat.adrian@gmail.com's Account` (ID: `43f8fd61c4e1b2676ee3ef818d65dc32`)
✅ **Token Permissions**: All required scopes enabled (workers, secrets_store, etc.)

## 1. Local Development

### Install Dependencies
```bash
npm install
```

### Set Environment Variables
Create `.dev.vars` (gitignored) with:
```env
SUPABASE_URL=https://gdrybrtcwpgjtghoqlwo.supabase.co
SUPABASE_KEY=sb_publishable_Q1cskRuh7J0O_YHV1Kr0zA_nZ9Bj4yv
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
AI_PROVIDER=openrouter
OPENROUTER_API_KEY=<your-openrouter-key>
```

### Run Dev Server
```bash
npm run dev
```

The dev server will start on a local port (typically `http://localhost:4321` or higher if ports are in use).

## 2. Building for Production

### Production Build
```bash
npm run build
```

This creates an SSR build optimized for Cloudflare Workers with:
- Server-side rendering via Astro
- Cloudflare KV for sessions
- Proper asset bundling and caching

### Preview Production Build
```bash
npm run preview
```

## 3. Cloudflare Secrets (Production)

The app requires `SUPABASE_SERVICE_ROLE_KEY` for the account deletion feature. This must be configured as a Cloudflare secret (not in source control).

### Set the Secret
```bash
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
```

When prompted, paste your Supabase Service Role key (from Supabase project settings → API → Service Role key).

### View Configured Secrets
```bash
npx wrangler secret list
```

### Delete a Secret (if needed)
```bash
npx wrangler secret delete SUPABASE_SERVICE_ROLE_KEY
```

## 4. Deployment to Cloudflare Workers

### Deploy
```bash
npx wrangler deploy
```

This command:
- Builds the app (`npm run build`)
- Uploads the compiled Worker to Cloudflare
- Activates the new version immediately

### Check Deployment Status
```bash
npx wrangler deployments list
```

### View Live Logs
```bash
npx wrangler tail
```

Streams real-time logs from your deployed Worker.

## 5. Environment Variables & Secrets

### Local Development (`.dev.vars`)
- Contains all env vars including service role key
- Gitignored; never commit
- Used by `npm run dev` and `npm test`

### Production (Cloudflare Secrets)
- `SUPABASE_SERVICE_ROLE_KEY` must be set via `npx wrangler secret put`
- Public env vars (SUPABASE_URL, etc.) are in `astro.config.mjs` under `env.schema`
- Secrets are injected at runtime via `Env` parameter

### CI/CD (GitHub Actions)
- `.github/workflows/ci.yml` uses repository secrets
- `SUPABASE_URL` and `SUPABASE_KEY` are required for build step
- `SUPABASE_SERVICE_ROLE_KEY` is required for integration tests

## 6. Account Deletion Feature (Phase 4)

The account deletion endpoint (`POST /api/auth/delete-account`) requires `SUPABASE_SERVICE_ROLE_KEY` to call Supabase's admin API (`auth.admin.deleteUser()`).

### Production Setup for Account Deletion
1. Ensure `SUPABASE_SERVICE_ROLE_KEY` is set via:
   ```bash
   npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
   ```
2. Deploy:
   ```bash
   npx wrangler deploy
   ```
3. Test the deletion flow on the live app:
   - Navigate to `/settings`
   - Check "I understand this is permanent"
   - Click "Delete Account"
   - Verify redirect to `/auth/signin?deleted=true`
   - Verify deletion notice appears

## 7. Troubleshooting

### Authentication Issues
```bash
npx wrangler login
```

### Secret Not Found in Worker
- Verify the secret was set: `npx wrangler secret list`
- Check that `createAdminClient()` in `src/lib/supabase.ts` reads from `SUPABASE_SERVICE_ROLE_KEY`
- Redeploy after setting the secret: `npx wrangler deploy`

### Build Failures
```bash
npm run lint          # Check for lint errors
npm run build         # Test the build locally
npm test              # Run tests
```

### Connection Issues
- Verify `.dev.vars` has correct Supabase credentials
- Check Supabase project is active and accessible
- Verify KV namespace binding in `wrangler.json`

## 8. Resources

- **Cloudflare Workers Docs**: https://developers.cloudflare.com/workers/
- **Astro Cloudflare Adapter**: https://docs.astro.build/en/guides/integrations-guide/cloudflare/
- **Supabase Auth**: https://supabase.com/docs/guides/auth
- **Wrangler CLI**: https://developers.cloudflare.com/workers/wrangler/

## Checklist for New Deployments

- [ ] All tests pass (`npm test`)
- [ ] Build succeeds locally (`npm run build`)
- [ ] Lint passes (`npm run lint`)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is set in Cloudflare (`npx wrangler secret list`)
- [ ] Deploy: `npx wrangler deploy`
- [ ] Monitor live logs: `npx wrangler tail`
- [ ] Test critical flows on live app (auth, canvas creation, account deletion)
