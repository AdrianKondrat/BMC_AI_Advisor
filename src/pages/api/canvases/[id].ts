import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";

export const prerender = false;

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
