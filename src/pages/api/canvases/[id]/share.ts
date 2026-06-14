import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";

export const prerender = false;

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sevenDaysFromNow(): string {
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
}

export const GET: APIRoute = async (context) => {
  if (!context.locals.user) {
    return new Response(null, { status: 401 });
  }

  const id = context.params.id;
  if (!id || !UUID_REGEX.test(id)) {
    return new Response(null, { status: 400 });
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return new Response(null, { status: 500 });
  }

  // Verify ownership by fetching the canvas first
  const { data: canvas } = await supabase
    .from("canvases")
    .select("id")
    .eq("id", id)
    .eq("owner_id", context.locals.user.id)
    .maybeSingle();

  if (!canvas) {
    return new Response(null, { status: 401 });
  }

  const { data, error } = await supabase
    .from("share_links")
    .select("*")
    .eq("canvas_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return new Response(null, { status: 500 });
  }

  if (!data) {
    return new Response(null, { status: 404 });
  }

  return Response.json({ shareLink: data }, { status: 200 });
};

export const POST: APIRoute = async (context) => {
  if (!context.locals.user) {
    return new Response(null, { status: 401 });
  }

  const id = context.params.id;
  if (!id || !UUID_REGEX.test(id)) {
    return new Response(null, { status: 400 });
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return new Response(null, { status: 500 });
  }

  // Verify ownership
  const { data: canvas } = await supabase
    .from("canvases")
    .select("id")
    .eq("id", id)
    .eq("owner_id", context.locals.user.id)
    .maybeSingle();

  if (!canvas) {
    return new Response(null, { status: 401 });
  }

  const { data, error } = await supabase.rpc("rotate_share_link", {
    canvas_uuid: id,
    expires_at: sevenDaysFromNow(),
  });

  if (error || !data) {
    return new Response(null, { status: 500 });
  }

  return Response.json({ shareLink: data }, { status: 201 });
};

export const PATCH: APIRoute = async (context) => {
  if (!context.locals.user) {
    return new Response(null, { status: 401 });
  }

  const id = context.params.id;
  if (!id || !UUID_REGEX.test(id)) {
    return new Response(null, { status: 400 });
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return new Response(null, { status: 500 });
  }

  // Verify ownership
  const { data: canvas } = await supabase
    .from("canvases")
    .select("id")
    .eq("id", id)
    .eq("owner_id", context.locals.user.id)
    .maybeSingle();

  if (!canvas) {
    return new Response(null, { status: 401 });
  }

  const { data, error } = await supabase
    .from("share_links")
    .update({ expires_at: sevenDaysFromNow() })
    .eq("canvas_id", id)
    .select("*")
    .maybeSingle();

  if (error) {
    return new Response(null, { status: 500 });
  }

  if (!data) {
    return new Response(null, { status: 404 });
  }

  return Response.json({ shareLink: data }, { status: 200 });
};

export const DELETE: APIRoute = async (context) => {
  if (!context.locals.user) {
    return new Response(null, { status: 401 });
  }

  const id = context.params.id;
  if (!id || !UUID_REGEX.test(id)) {
    return new Response(null, { status: 400 });
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return new Response(null, { status: 500 });
  }

  // Verify ownership before deleting
  const { data: canvas } = await supabase
    .from("canvases")
    .select("id")
    .eq("id", id)
    .eq("owner_id", context.locals.user.id)
    .maybeSingle();

  if (!canvas) {
    return new Response(null, { status: 404 });
  }

  const { error } = await supabase.from("share_links").delete().eq("canvas_id", id);

  if (error) {
    return new Response(null, { status: 500 });
  }

  return new Response(null, { status: 204 });
};
