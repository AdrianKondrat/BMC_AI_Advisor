# Lessons Learned

> Append-only register of recurring rules and patterns. Re-read at start by /10x-frame, /10x-research, /10x-plan, /10x-plan-review, /10x-implement, /10x-impl-review.

## Always add an explicit owner filter alongside RLS on Supabase mutations

- **Context**: API routes using Supabase — any route that creates a Supabase SSR client and runs DELETE or UPDATE queries relying on RLS.
- **Problem**: DELETE returns 204 but the row is not removed. The `@supabase/ssr` client may not attach the session JWT to database requests automatically, so `auth.uid()` is unset in PostgREST context and the RLS policy silently blocks the operation as a no-op.
- **Rule**: Always add `.eq('owner_id', context.locals.user.id)` (or the relevant ownership column) as an explicit filter on any Supabase DELETE or UPDATE in an API route — do not rely solely on RLS for mutation authorization.
- **Applies to**: plan, implement, impl-review

## Never edit a committed migration file

- **Context**: Supabase migrations — any file in `supabase/migrations/` that has already been committed and may have been applied to any environment (local, remote, staging).
- **Problem**: Editing an already-applied migration creates a state mismatch: the environment that ran the original file is in a different schema state than what's on disk. This breaks idempotent re-apply and makes the migration history unreliable. Even in a solo project, Supabase remote and local can diverge this way.
- **Rule**: Treat committed migrations as immutable. If a migration has a bug after it has been committed (but before any environment ran it, it may be safe to delete and recreate with the same timestamp). Once applied anywhere, create a new compensating migration instead of editing the original.
- **Applies to**: plan, implement, impl-review
