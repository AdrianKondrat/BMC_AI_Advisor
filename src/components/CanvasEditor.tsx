import { useEffect, useRef, useState } from "react";
import type { BlockCritique, BMCBlockKey, Canvas, CanvasCritique, CanvasBlocks, ShareLink } from "@/types";
import { cn } from "@/lib/utils";
import SharePanel from "@/components/SharePanel";

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
type CritiqueStatus = "idle" | "loading" | "error";

const CATEGORY_STYLES: Record<BlockCritique["category"], string> = {
  consistency: "bg-yellow-500/20 text-yellow-300",
  completeness: "bg-blue-500/20 text-blue-300",
  investor: "bg-orange-500/20 text-orange-300",
};

interface Props {
  canvas: Canvas;
  initialShareLink?: ShareLink | null;
}

interface BlockCellProps {
  blockKey: BMCBlockKey;
  content: string;
  isActive: boolean;
  onClick: () => void;
  onChange: (value: string) => void;
  onBlur: () => void;
  critique?: BlockCritique;
  className?: string;
}

function BlockCell({ blockKey, content, isActive, onClick, onChange, onBlur, critique, className }: BlockCellProps) {
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
      {!isActive && critique && (
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

export default function CanvasEditor({ canvas, initialShareLink }: Props) {
  const [blocks, setBlocks] = useState<CanvasBlocks>(() => initBlocks(canvas.blocks));
  const [activeBlock, setActiveBlock] = useState<BMCBlockKey | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [critique, setCritique] = useState<CanvasCritique | null>(canvas.critique ?? null);
  const [critiqueStatus, setCritiqueStatus] = useState<CritiqueStatus>("idle");
  const blocksRef = useRef(blocks);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queuedBlocksRef = useRef<CanvasBlocks | null>(null);
  const isSavingRef = useRef(false);
  const savePromiseRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    blocksRef.current = blocks;
  }, [blocks]);

  async function saveBlocks(currentBlocks: CanvasBlocks) {
    queuedBlocksRef.current = currentBlocks;
    if (isSavingRef.current) {
      return savePromiseRef.current ?? Promise.resolve();
    }

    isSavingRef.current = true;
    setSaveStatus("saving");

    savePromiseRef.current = (async () => {
      try {
        while (queuedBlocksRef.current) {
          const blocksToSave = queuedBlocksRef.current;
          queuedBlocksRef.current = null;

          try {
            const res = await fetch(`/api/canvases/${canvas.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ blocks: blocksToSave }),
            });
            setSaveStatus(res.ok ? "saved" : "error");
          } catch {
            setSaveStatus("error");
          }
        }
      } finally {
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => {
          setSaveStatus("idle");
        }, 2000);
        isSavingRef.current = false;
        savePromiseRef.current = null;
      }
    })();

    return savePromiseRef.current;
  }

  async function runCritique() {
    setCritiqueStatus("loading");
    try {
      await saveBlocks(blocksRef.current);
      const res = await fetch(`/api/canvases/${canvas.id}/critique`, { method: "POST" });
      if (res.ok) {
        setCritique((await res.json()) as CanvasCritique);
        setCritiqueStatus("idle");
      } else {
        setCritiqueStatus("error");
      }
    } catch {
      setCritiqueStatus("error");
    }
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

  const critiqueButtonLabel =
    critiqueStatus === "loading" ? "Analysing…" : critique ? "Re-run Critique" : "Run Critique";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white">{canvas.name ?? "Untitled canvas"}</h1>
        <div className="flex items-center gap-3">
          {statusText && (
            <span className={cn("text-sm", saveStatus === "error" ? "text-red-400" : "text-green-400")}>
              {statusText}
            </span>
          )}
          {critiqueStatus === "error" && <span className="text-sm text-red-400">Critique failed — try again</span>}
          <SharePanel canvasId={canvas.id} initialShareLink={initialShareLink ?? null} />
          <button
            onClick={() => {
              void runCritique();
            }}
            disabled={critiqueStatus === "loading"}
            className="rounded-md bg-white/10 px-3 py-1.5 text-sm text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {critiqueButtonLabel}
          </button>
        </div>
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
          critique={critique?.key_partners}
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
          critique={critique?.key_activities}
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
          critique={critique?.value_propositions}
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
          critique={critique?.customer_relationships}
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
          critique={critique?.customer_segments}
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
          critique={critique?.key_resources}
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
          critique={critique?.channels}
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
          critique={critique?.cost_structure}
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
          critique={critique?.revenue_streams}
          className="md:col-span-3 md:col-start-3 md:row-start-3"
        />
      </div>
    </div>
  );
}
