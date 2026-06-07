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

export interface Canvas {
  id: string;
  owner_id: string;
  name: string | null;
  blocks: Partial<CanvasBlocks>;
  created_at: string;
  updated_at: string;
}

export interface ShareLink {
  id: string;
  canvas_id: string;
  token: string;
  expires_at: string | null;
  pin_hash: string | null;
  created_at: string;
}
