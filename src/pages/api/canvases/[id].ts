import type { APIRoute } from "astro";
import { z } from "zod";
import { createClient } from "@/lib/supabase";

export const prerender = false;

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MAX_BLOCK_TEXT = 2000;

const patchBodySchema = z.object({
  blocks: z.record(
    z.enum([
      "key_partners",
      "key_activities",
      "key_resources",
      "value_propositions",
      "customer_relationships",
      "channels",
      "customer_segments",
      "cost_structure",
      "revenue_streams",
    ]),
    z.string().max(MAX_BLOCK_TEXT),
  ),
});

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

  const { error } = await supabase.from("canvases").delete().eq("id", id).eq("owner_id", context.locals.user.id);

  if (error) {
    return new Response(null, { status: 500 });
  }

  return new Response(null, { status: 204 });
};

export const PATCH: APIRoute = async (context) => {
  if (!context.locals.user) {
    return new Response(null, { status: 401 });
  }

  const id = context.params.id;
  if (!id || !UUID_REGEX.test(id)) {
    return new Response(null, { status: 400 });
  }

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const result = patchBodySchema.safeParse(body);
  if (!result.success) {
    return Response.json({ error: result.error.issues }, { status: 400 });
  }

  const { blocks } = result.data;

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return new Response(null, { status: 500 });
  }

  const { data, error } = await supabase
    .from("canvases")
    .update({ blocks, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("owner_id", context.locals.user.id)
    .select("updated_at")
    .maybeSingle();

  if (error) {
    return new Response(null, { status: 500 });
  }

  if (!data) {
    return new Response(null, { status: 404 });
  }

  return Response.json({ updated_at: data.updated_at }, { status: 200 });
};
