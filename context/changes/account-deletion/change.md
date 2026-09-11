---
change_id: account-deletion
title: Account deletion
status: implementing
created: 2026-09-11
updated: 2026-09-11
archived_at: null
---

## Notes

Roadmap S-05: User can permanently delete their account and all associated data (canvases, blocks, share links) with a confirmation step before the action is irreversible.

Implementation scope:

- Settings page UI (`/settings` route with RLS middleware protection)
- DeleteAccountButton component with checkbox confirmation dialog
- Dashboard link to settings
- Sign-in `?deleted=true` notice for deleted accounts
- Cloudflare `SUPABASE_SERVICE_ROLE_KEY` secret setup
- Backend `POST /api/auth/delete-account` already drafted

See roadmap S-05 (line 157–170) for full context and acceptance criteria.
