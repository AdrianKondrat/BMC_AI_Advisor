import type { BlockCritique, BMCBlockKey, Canvas } from "@/types";
import { cn } from "@/lib/utils";

const BMC_BLOCK_LABELS: Record<BMCBlockKey, string> = {
  key_partners: "Key Partners",
  key_activities: "Key Activities",
  key_resources: "Key Resources",
  value_propositions: "Value Propositions",
  customer_relationships: "Customer Relationships",
  channels: "Channels",
  customer_segments: "Customer Segments",
  cost_structure: "Cost Structure",
  revenue_streams: "Revenue Streams",
};

const ALL_BLOCK_KEYS: BMCBlockKey[] = [
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

const CATEGORY_STYLES: Record<BlockCritique["category"], string> = {
  consistency: "bg-yellow-500/20 text-yellow-300",
  completeness: "bg-blue-500/20 text-blue-300",
  investor: "bg-orange-500/20 text-orange-300",
};

interface BlockCellProps {
  blockKey: BMCBlockKey;
  content: string;
  critique?: BlockCritique;
  className?: string;
}

function BlockCell({ blockKey, content, critique, className }: BlockCellProps) {
  return (
    <div className={cn("flex min-h-[100px] flex-col rounded-lg border border-white/10 bg-white/5 p-3", className)}>
      <h3 className="mb-2 text-[10px] font-semibold tracking-widest text-white/40 uppercase">
        {BMC_BLOCK_LABELS[blockKey]}
      </h3>
      {content ? (
        <p className="text-sm whitespace-pre-wrap text-white">{content}</p>
      ) : (
        <p className="text-sm text-white/30 italic">—</p>
      )}
      {critique && (
        <div className="mt-2 border-t border-white/10 pt-2">
          <span
            className={cn(
              "inline-block rounded px-1.5 py-0.5 text-[10px] font-medium",
              CATEGORY_STYLES[critique.category],
            )}
          >
            {critique.category}
          </span>
          <p className="mt-1 text-xs text-white/60">{critique.text}</p>
        </div>
      )}
    </div>
  );
}

interface Props {
  canvas: Canvas;
}

export default function CanvasReadOnly({ canvas }: Props) {
  const blocks = canvas.blocks;
  const critique = canvas.critique;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white">{canvas.name ?? "Untitled canvas"}</h1>
        <span className="rounded-md bg-white/10 px-3 py-1.5 text-sm text-white/60">Read-only</span>
      </div>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-5 md:grid-rows-3">
        {ALL_BLOCK_KEYS.map((key) => {
          const classNames: Record<BMCBlockKey, string> = {
            key_partners: "md:col-start-1 md:row-span-2 md:row-start-1",
            key_activities: "md:col-start-2 md:row-start-1",
            key_resources: "md:col-start-2 md:row-start-2",
            value_propositions: "md:col-start-3 md:row-span-2 md:row-start-1",
            customer_relationships: "md:col-start-4 md:row-start-1",
            channels: "md:col-start-4 md:row-start-2",
            customer_segments: "md:col-start-5 md:row-span-2 md:row-start-1",
            cost_structure: "md:col-span-2 md:col-start-1 md:row-start-3",
            revenue_streams: "md:col-span-3 md:col-start-3 md:row-start-3",
          };
          return (
            <BlockCell
              key={key}
              blockKey={key}
              content={blocks[key] ?? ""}
              critique={critique?.[key] ?? undefined}
              className={classNames[key]}
            />
          );
        })}
      </div>
    </div>
  );
}
