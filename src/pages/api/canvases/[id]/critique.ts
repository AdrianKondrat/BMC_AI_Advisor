import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { critiqueBMCCanvas } from "@/lib/services/ai";
import type { CanvasBlocks } from "@/types";

export const prerender = false;

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const BMC_KEYS: (keyof CanvasBlocks)[] = [
  "key_partners",
  "key_activities",
  "key_resources",
  "value_propositions",
  "customer_relationships",
  "channels",
  "customer_segments",
  "cost_structure",
  "revenue_streams",
];

export const POST: APIRoute = async (context) => {
  if (!context.locals.user) {
    return new Response(null, { status: 401 });
  }

  const id = context.params.id;
  if (!id || !UUID_REGEX.test(id)) {
    return new Response(null, { status: 400 });
  }

  const userId = context.locals.user.id;

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return new Response(null, { status: 500 });
  }

  const { data: canvas, error: fetchError } = await supabase
    .from("canvases")
    .select("blocks")
    .eq("id", id)
    .eq("owner_id", userId)
    .limit(1)
    .maybeSingle();

  if (fetchError) {
    return new Response(null, { status: 500 });
  }

  if (!canvas) {
    return new Response(null, { status: 404 });
  }

  const blocks = canvas.blocks as Partial<CanvasBlocks>;
  const allFilled = BMC_KEYS.every((key) => {
    const val = blocks[key];
    return typeof val === "string" && val.trim().length > 0;
  });

  if (!allFilled) {
    return Response.json({ error: "All 9 blocks must be filled before running critique" }, { status: 400 });
  }

  let result;
  try {
    result = await critiqueBMCCanvas(blocks as CanvasBlocks);
  } catch (err) {
    console.error("critiqueBMCCanvas failed:", err);
    return new Response(null, { status: 500 });
  }

  const { error: updateError } = await supabase
    .from("canvases")
    .update({ critique: result })
    .eq("id", id)
    .eq("owner_id", userId);

  if (updateError) {
    return new Response(null, { status: 500 });
  }

  return Response.json(result, { status: 200 });
};
