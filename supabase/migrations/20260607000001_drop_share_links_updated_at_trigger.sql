-- share_links has no updated_at column; the trigger added in the initial
-- migration fires set_updated_at() which sets NEW.updated_at = now(),
-- causing a runtime error on any UPDATE to share_links.
DROP TRIGGER IF EXISTS share_links_updated_at ON share_links;
