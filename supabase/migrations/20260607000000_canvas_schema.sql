-- Enable pgcrypto for gen_random_bytes (share token generation)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- Table: canvases
-- ============================================================
CREATE TABLE canvases (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id   uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       text,
  blocks     jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- Table: share_links
-- ============================================================
CREATE TABLE share_links (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  canvas_id  uuid        NOT NULL REFERENCES canvases(id) ON DELETE CASCADE,
  token      text        NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at timestamptz,
  pin_hash   text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- updated_at trigger function
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER canvases_updated_at
  BEFORE UPDATE ON canvases
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER share_links_updated_at
  BEFORE UPDATE ON share_links
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- Row Level Security
-- ============================================================
ALTER TABLE canvases    ENABLE ROW LEVEL SECURITY;
ALTER TABLE share_links ENABLE ROW LEVEL SECURITY;

-- canvases policies (authenticated role)
CREATE POLICY "owners can select own canvases"
  ON canvases FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "owners can insert own canvases"
  ON canvases FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "owners can update own canvases"
  ON canvases FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "owners can delete own canvases"
  ON canvases FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());

-- share_links policies (authenticated role — owner via join)
CREATE POLICY "owners can select own share_links"
  ON share_links FOR SELECT
  TO authenticated
  USING (canvas_id IN (SELECT id FROM canvases WHERE owner_id = auth.uid()));

CREATE POLICY "owners can insert own share_links"
  ON share_links FOR INSERT
  TO authenticated
  WITH CHECK (canvas_id IN (SELECT id FROM canvases WHERE owner_id = auth.uid()));

CREATE POLICY "owners can update own share_links"
  ON share_links FOR UPDATE
  TO authenticated
  USING (canvas_id IN (SELECT id FROM canvases WHERE owner_id = auth.uid()));

CREATE POLICY "owners can delete own share_links"
  ON share_links FOR DELETE
  TO authenticated
  USING (canvas_id IN (SELECT id FROM canvases WHERE owner_id = auth.uid()));

-- share_links policy (anon role — S-04 stub: read valid/non-expired links)
-- ACCEPTED RISK: this policy exposes the token and pin_hash columns to unauthenticated
-- callers. RLS cannot restrict columns, only rows. Accepted because no real data exists
-- before S-04, which will replace this stub with an application-layer token-validation
-- endpoint that never returns these columns to the client.
CREATE POLICY "public can read valid share_links"
  ON share_links FOR SELECT
  TO anon
  USING (expires_at IS NULL OR expires_at > now());
