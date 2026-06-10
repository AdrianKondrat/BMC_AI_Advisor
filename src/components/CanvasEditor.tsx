import { useEffect, useRef, useState } from "react";
import type { BMCBlockKey, Canvas, CanvasBlocks } from "@/types";
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

function initBlocks(partial: Partial<CanvasBlocks>): CanvasBlocks {
  return Object.fromEntries(ALL_BLOCK_KEYS.map((k) => [k, partial[k] ?? ""])) as CanvasBlocks;
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

interface Props {
  canvas: Canvas;
}

interface BlockCellProps {
  blockKey: BMCBlockKey;
  content: string;
  isActive: boolean;
  onClick: () => void;
  onChange: (value: string) => void;
  onBlur: () => void;
  className?: string;
}

function BlockCell({ blockKey, content, isActive, onClick, onChange, onBlur, className }: BlockCellProps) {
  return (
    <div
      className={cn(
        "flex min-h-[100px] cursor-pointer flex-col rounded-lg border border-white/10 bg-white/5 p-3",
        className,
      )}
      onClick={!isActive ? onClick : undefined}
    >
      <h3 className="mb-2 text-[10px] font-semibold tracking-widest text-white/40 uppercase">
        {BMC_BLOCK_LABELS[blockKey]}
      </h3>
      {isActive ? (
        <textarea
          autoFocus
          value={content}
          onChange={(e) => {
            onChange(e.target.value);
          }}
          onBlur={onBlur}
          onClick={(e) => {
            e.stopPropagation();
          }}
          className="min-h-[80px] w-full flex-1 resize-none bg-transparent text-sm text-white outline-none"
        />
      ) : content ? (
        <p className="text-sm whitespace-pre-wrap text-white">{content}</p>
      ) : (
        <p className="text-sm text-white/30 italic">Click to add…</p>
      )}
    </div>
  );
}

export default function CanvasEditor({ canvas }: Props) {
  const [blocks, setBlocks] = useState<CanvasBlocks>(() => initBlocks(canvas.blocks));
  const [activeBlock, setActiveBlock] = useState<BMCBlockKey | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const blocksRef = useRef(blocks);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    blocksRef.current = blocks;
  }, [blocks]);

  async function saveBlocks(currentBlocks: CanvasBlocks) {
    setSaveStatus("saving");
    try {
      const res = await fetch(`/api/canvases/${canvas.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocks: currentBlocks }),
      });
      setSaveStatus(res.ok ? "saved" : "error");
    } catch {
      setSaveStatus("error");
    }
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      setSaveStatus("idle");
    }, 2000);
  }

  function handleBlockChange(key: BMCBlockKey, value: string) {
    setBlocks((prev) => ({ ...prev, [key]: value }));
  }

  function handleBlur() {
    setActiveBlock(null);
    void saveBlocks(blocksRef.current);
  }

  const statusText =
    saveStatus === "saving"
      ? "Saving…"
      : saveStatus === "saved"
        ? "Saved ✓"
        : saveStatus === "error"
          ? "Error saving"
          : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white">{canvas.name ?? "Untitled canvas"}</h1>
        {statusText && (
          <span className={cn("text-sm", saveStatus === "error" ? "text-red-400" : "text-green-400")}>
            {statusText}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-5 md:grid-rows-3">
        <BlockCell
          blockKey="key_partners"
          content={blocks.key_partners}
          isActive={activeBlock === "key_partners"}
          onClick={() => {
            setActiveBlock("key_partners");
          }}
          onChange={(v) => {
            handleBlockChange("key_partners", v);
          }}
          onBlur={handleBlur}
          className="md:col-start-1 md:row-span-2 md:row-start-1"
        />
        <BlockCell
          blockKey="key_activities"
          content={blocks.key_activities}
          isActive={activeBlock === "key_activities"}
          onClick={() => {
            setActiveBlock("key_activities");
          }}
          onChange={(v) => {
            handleBlockChange("key_activities", v);
          }}
          onBlur={handleBlur}
          className="md:col-start-2 md:row-start-1"
        />
        <BlockCell
          blockKey="value_propositions"
          content={blocks.value_propositions}
          isActive={activeBlock === "value_propositions"}
          onClick={() => {
            setActiveBlock("value_propositions");
          }}
          onChange={(v) => {
            handleBlockChange("value_propositions", v);
          }}
          onBlur={handleBlur}
          className="md:col-start-3 md:row-span-2 md:row-start-1"
        />
        <BlockCell
          blockKey="customer_relationships"
          content={blocks.customer_relationships}
          isActive={activeBlock === "customer_relationships"}
          onClick={() => {
            setActiveBlock("customer_relationships");
          }}
          onChange={(v) => {
            handleBlockChange("customer_relationships", v);
          }}
          onBlur={handleBlur}
          className="md:col-start-4 md:row-start-1"
        />
        <BlockCell
          blockKey="customer_segments"
          content={blocks.customer_segments}
          isActive={activeBlock === "customer_segments"}
          onClick={() => {
            setActiveBlock("customer_segments");
          }}
          onChange={(v) => {
            handleBlockChange("customer_segments", v);
          }}
          onBlur={handleBlur}
          className="md:col-start-5 md:row-span-2 md:row-start-1"
        />
        <BlockCell
          blockKey="key_resources"
          content={blocks.key_resources}
          isActive={activeBlock === "key_resources"}
          onClick={() => {
            setActiveBlock("key_resources");
          }}
          onChange={(v) => {
            handleBlockChange("key_resources", v);
          }}
          onBlur={handleBlur}
          className="md:col-start-2 md:row-start-2"
        />
        <BlockCell
          blockKey="channels"
          content={blocks.channels}
          isActive={activeBlock === "channels"}
          onClick={() => {
            setActiveBlock("channels");
          }}
          onChange={(v) => {
            handleBlockChange("channels", v);
          }}
          onBlur={handleBlur}
          className="md:col-start-4 md:row-start-2"
        />
        <BlockCell
          blockKey="cost_structure"
          content={blocks.cost_structure}
          isActive={activeBlock === "cost_structure"}
          onClick={() => {
            setActiveBlock("cost_structure");
          }}
          onChange={(v) => {
            handleBlockChange("cost_structure", v);
          }}
          onBlur={handleBlur}
          className="md:col-span-2 md:col-start-1 md:row-start-3"
        />
        <BlockCell
          blockKey="revenue_streams"
          content={blocks.revenue_streams}
          isActive={activeBlock === "revenue_streams"}
          onClick={() => {
            setActiveBlock("revenue_streams");
          }}
          onChange={(v) => {
            handleBlockChange("revenue_streams", v);
          }}
          onBlur={handleBlur}
          className="md:col-span-3 md:col-start-3 md:row-start-3"
        />
      </div>
    </div>
  );
}
