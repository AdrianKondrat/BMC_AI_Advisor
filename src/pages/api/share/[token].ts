import type { APIRoute } from "astro";
import { createAnonClient } from "@/lib/supabase";

const TOKEN_REGEX = /^[0-9a-zA-Z_-]+$/;

export const prerender = false;

const isExpired = (expiresAt: string | null) => {
  if (!expiresAt) {
    return false;
  }
  return new Date(expiresAt) < new Date();
};

export const GET: APIRoute = async ({ params }) => {
  const token = params.token;
  if (!token || !TOKEN_REGEX.test(token)) {
    return new Response(null, { status: 400 });
  }

  const supabase = createAnonClient();
  if (!supabase) {
    return new Response(null, { status: 500 });
  }

  const { data: shareLink, error: shareError } = await supabase
    .from("share_links")
    .select("canvas_id, expires_at")
    .eq("token", token)
    .single();

  if (shareError || !shareLink || isExpired(shareLink.expires_at)) {
    return new Response(null, { status: 404 });
  }

  const { data: canvas, error: canvasError } = await supabase
    .from("canvases")
    .select("*")
    .eq("id", shareLink.canvas_id)
    .single();

  if (canvasError || !canvas) {
    return new Response(null, { status: 404 });
  }

  return Response.json({ canvas, shareLink }, { status: 200 });
};
