import type { APIRoute } from "astro";
import { z } from "zod";
import { createClient } from "@/lib/supabase";
import { generateBMCCanvas } from "@/lib/services/ai";

export const prerender = false;

const bodySchema = z.object({
  idea: z.string().min(10).max(2000),
});

export const POST: APIRoute = async (context) => {
  if (!context.locals.user) {
    return new Response(null, { status: 401 });
  }

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const result = bodySchema.safeParse(body);
  if (!result.success) {
    const errorMessage = result.error.issues
      .map((issue) => {
        const path = issue.path.length ? issue.path.join(".") : "body";
        return `${path}: ${issue.message}`;
      })
      .join("; ");

    return Response.json({ error: errorMessage }, { status: 400 });
  }

  const { idea } = result.data;

  let generated: Awaited<ReturnType<typeof generateBMCCanvas>>;
  try {
    generated = await generateBMCCanvas(idea);
  } catch (err) {
    console.error("[POST /api/canvases] AI error:", err);
    return Response.json({ error: "AI generation failed" }, { status: 500 });
  }

  const { name, ...blocks } = generated;

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    console.error(
      "[POST /api/canvases] Supabase client unavailable — check SUPABASE_URL and SUPABASE_KEY in .dev.vars",
    );
    return Response.json({ error: "Database is not configured" }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("canvases")
    .insert({
      owner_id: context.locals.user.id,
      name,
      blocks,
      idea,
    })
    .select("id, name, blocks")
    .single();

  if (error) {
    console.error("[POST /api/canvases] Supabase insert error:", error.message);
    return Response.json({ error: "Canvas creation failed" }, { status: 500 });
  }

  return Response.json({ id: data.id, name: data.name, blocks: data.blocks }, { status: 201 });
};
