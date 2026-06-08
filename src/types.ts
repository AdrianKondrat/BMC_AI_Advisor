import type { Tables } from "@/lib/database.types";

export type BMCBlockKey =
  | "key_partners"
  | "key_activities"
  | "key_resources"
  | "value_propositions"
  | "customer_relationships"
  | "channels"
  | "customer_segments"
  | "cost_structure"
  | "revenue_streams";

export type CanvasBlocks = Record<BMCBlockKey, string>;

// Canvas row with blocks narrowed from Json to the BMC domain shape.
// The DB column is jsonb (typed as Json in the generated types); we narrow
// it here so downstream code gets compile-time BMC key checking.
export type Canvas = Omit<Tables<"canvases">, "blocks"> & {
  blocks: Partial<CanvasBlocks>;
};

export type ShareLink = Tables<"share_links">;

export type CanvasSummary = Pick<Tables<"canvases">, "id" | "name" | "created_at" | "updated_at">;
