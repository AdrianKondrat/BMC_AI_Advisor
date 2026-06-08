# Lessons Learned

> Append-only register of recurring rules and patterns. Re-read at start by /10x-frame, /10x-research, /10x-plan, /10x-plan-review, /10x-implement, /10x-impl-review.

## Always add an explicit owner filter alongside RLS on Supabase mutations

- **Context**: API routes using Supabase — any route that creates a Supabase SSR client and runs DELETE or UPDATE queries relying on RLS.
- **Problem**: DELETE returns 204 but the row is not removed. The `@supabase/ssr` client may not attach the session JWT to database requests automatically, so `auth.uid()` is unset in PostgREST context and the RLS policy silently blocks the operation as a no-op.
- **Rule**: Always add `.eq('owner_id', context.locals.user.id)` (or the relevant ownership column) as an explicit filter on any Supabase DELETE or UPDATE in an API route — do not rely solely on RLS for mutation authorization.
- **Applies to**: plan, implement, impl-review
