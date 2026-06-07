-- The original UPDATE policy had only USING, not WITH CHECK.
-- Without WITH CHECK, an owner could change owner_id to any other user's
-- UUID, silently transferring canvas ownership.
DROP POLICY IF EXISTS "owners can update own canvases" ON canvases;

CREATE POLICY "owners can update own canvases"
  ON canvases FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());
