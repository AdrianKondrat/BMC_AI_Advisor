CREATE OR REPLACE FUNCTION rotate_share_link(canvas_uuid uuid, expires_at timestamptz DEFAULT NULL)
RETURNS share_links
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_link share_links%ROWTYPE;
BEGIN
  INSERT INTO share_links (canvas_id, expires_at)
  VALUES (canvas_uuid, expires_at)
  RETURNING * INTO new_link;

  DELETE FROM share_links
  WHERE canvas_id = canvas_uuid
    AND id != new_link.id;

  RETURN new_link;
END;
$$;
