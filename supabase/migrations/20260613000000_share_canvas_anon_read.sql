CREATE POLICY "anon can read shared canvases"
  ON canvases
  FOR SELECT
  TO anon
  USING (
    id IN (
      SELECT canvas_id FROM share_links
      WHERE expires_at IS NULL OR expires_at > now()
    )
  );
