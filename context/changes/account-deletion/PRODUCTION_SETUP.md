# Account Deletion — Production Setup Guide

After merging account-deletion Phase 4 to main, follow these steps to enable account deletion on the live app:

## Prerequisites

- Merged branch with Phase 4 (integration tests and deletion API)
- Cloudflare account with appropriate permissions
- Supabase Service Role key from your Supabase project

## Step 1: Set the Cloudflare Secret

The account deletion endpoint needs `SUPABASE_SERVICE_ROLE_KEY` to call Supabase's admin API.

```bash
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
```

When prompted, paste your Supabase Service Role key:
1. Go to your Supabase project dashboard
2. Navigate to **Settings** → **API**
3. Copy the **Service Role** key (labeled `SUPABASE_SERVICE_ROLE_KEY`)
4. Paste into the wrangler prompt

Verify the secret was set:
```bash
npx wrangler secret list
```

You should see `SUPABASE_SERVICE_ROLE_KEY` in the list.

## Step 2: Deploy to Cloudflare

```bash
npx wrangler deploy
```

This will:
- Build the app with Astro SSR
- Upload the Worker code to Cloudflare
- Activate the new version
- Make the deletion feature live

## Step 3: Verify the Feature Works

Test the account deletion flow on your live app:

1. **Create a test account**
   - Navigate to `/auth/signup`
   - Sign up with a test email

2. **Access Settings**
   - Click "Settings" in the dashboard header
   - Verify you're on `/settings`

3. **Initiate Deletion**
   - Scroll to "Danger Zone"
   - Check "I understand this is permanent"
   - Click "Delete Account"
   - Confirm in the AlertDialog

4. **Verify Success**
   - You should be redirected to `/auth/signin?deleted=true`
   - A green alert should appear: "Your account has been permanently deleted"
   - Try logging in with the deleted email — should fail with "Invalid login credentials"

5. **Verify Database Cleanup**
   - Log in to your Supabase dashboard
   - Check that the test user is gone from `auth.users`
   - Verify their canvases and share_links were deleted (cascade)

## Step 4: Monitor

Watch for errors during and after deployment:

```bash
npx wrangler tail
```

This streams live logs from your Worker. Look for:
- Any 500 errors from `/api/auth/delete-account`
- Missing secret errors ("Server configuration error")
- Auth failures

## Troubleshooting

### "Server configuration error" on deletion attempt
- The `SUPABASE_SERVICE_ROLE_KEY` secret is not set
- Run `npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY` again
- Redeploy: `npx wrangler deploy`

### Deletion API returns 401
- User is not authenticated
- Check middleware is protecting `/settings` (it should be)

### User still exists after deletion
- Check that the cascade delete constraints are in place in Supabase
- Run: `supabase status` to verify local Supabase is healthy
- Check database logs in Supabase dashboard

### Account deletion works locally but not in production
- Verify the secret is set in the production Worker: `npx wrangler secret list`
- Verify the secret has the correct Supabase Service Role key
- Check that the build includes the updated `src/lib/supabase.ts`

## Related Documentation

- **Full Cloudflare Setup Guide**: See `CLOUDFLARE_SETUP.md` in the project root
- **Account Deletion Plan**: See `context/changes/account-deletion/plan.md`
- **API Endpoint**: `src/pages/api/auth/delete-account.ts`
- **Settings Page**: `src/pages/settings.astro`
- **Delete Component**: `src/components/account/DeleteAccountButton.tsx`

## Rollback

If you need to disable the account deletion feature:

1. Remove the secret:
   ```bash
   npx wrangler secret delete SUPABASE_SERVICE_ROLE_KEY
   ```

2. Redeploy (the endpoint will return 500 if the secret is missing):
   ```bash
   npx wrangler deploy
   ```

This gracefully disables the feature without requiring a code change.
