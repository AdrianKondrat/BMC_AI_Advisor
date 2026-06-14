import { useState } from "react";
import type { ShareLink } from "@/types";
import { cn } from "@/lib/utils";

interface Props {
  canvasId: string;
  initialShareLink: ShareLink | null;
}

export default function SharePanel({ canvasId, initialShareLink }: Props) {
  const [shareLink, setShareLink] = useState<ShareLink | null>(initialShareLink);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [copied, setCopied] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const isExpired = shareLink?.expires_at ? new Date(shareLink.expires_at) <= new Date() : false;

  const expiryLabel = shareLink?.expires_at
    ? isExpired
      ? "Expired"
      : `Expires ${new Date(shareLink.expires_at).toLocaleDateString()}`
    : null;

  async function handleCreate() {
    setStatus("loading");
    try {
      const res = await fetch(`/api/canvases/${canvasId}/share`, { method: "POST" });
      if (res.ok) {
        const data = (await res.json()) as { shareLink: ShareLink };
        setShareLink(data.shareLink);
        setStatus("idle");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  async function handleRenew() {
    setStatus("loading");
    try {
      const res = await fetch(`/api/canvases/${canvasId}/share`, { method: "PATCH" });
      if (res.ok) {
        const data = (await res.json()) as { shareLink: ShareLink };
        setShareLink(data.shareLink);
        setStatus("idle");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  async function handleRevoke() {
    setStatus("loading");
    try {
      const res = await fetch(`/api/canvases/${canvasId}/share`, { method: "DELETE" });
      if (res.ok || res.status === 204) {
        setShareLink(null);
        setStatus("idle");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  async function handleCopy() {
    if (!shareLink) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/share/${shareLink.token}`);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch {
      // clipboard API unavailable
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => {
          setIsOpen((o) => !o);
        }}
        className="rounded-md bg-white/10 px-3 py-1.5 text-sm text-white transition hover:bg-white/20"
      >
        Share
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 z-10 mt-2 w-72 rounded-lg border border-white/10 bg-slate-900 p-3 shadow-xl">
          {!shareLink ? (
            <div className="flex flex-col gap-2">
              {status === "error" && <p className="text-xs text-red-400">Something went wrong — try again</p>}
              <button
                onClick={() => {
                  void handleCreate();
                }}
                disabled={status === "loading"}
                className="rounded-md bg-white/10 px-3 py-1.5 text-sm text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {status === "loading" ? "Creating…" : "Create share link"}
              </button>
            </div>
          ) : isExpired ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-white/60">This share link has expired.</p>
              {status === "error" && <p className="text-xs text-red-400">Something went wrong — try again</p>}
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    void handleRenew();
                  }}
                  disabled={status === "loading"}
                  className="rounded-md bg-white/10 px-3 py-1.5 text-sm text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Renew
                </button>
                <button
                  onClick={() => {
                    void handleRevoke();
                  }}
                  disabled={status === "loading"}
                  className="rounded-md bg-red-500/20 px-3 py-1.5 text-sm text-red-300 transition hover:bg-red-500/30 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Revoke
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={`${window.location.origin}/share/${shareLink.token}`}
                  className="min-w-0 flex-1 rounded bg-white/10 px-2 py-1 text-xs text-white outline-none"
                />
                <button
                  onClick={() => {
                    void handleCopy();
                  }}
                  className="shrink-0 rounded bg-white/10 px-2 py-1 text-xs text-white transition hover:bg-white/20"
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
              {expiryLabel && <p className="text-xs text-white/50">{expiryLabel}</p>}
              {status === "error" && <p className="text-xs text-red-400">Something went wrong — try again</p>}
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    void handleRenew();
                  }}
                  disabled={status === "loading"}
                  className="rounded-md bg-white/10 px-3 py-1.5 text-sm text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Renew
                </button>
                <button
                  onClick={() => {
                    void handleRevoke();
                  }}
                  disabled={status === "loading"}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm transition disabled:cursor-not-allowed disabled:opacity-50",
                    "bg-red-500/20 text-red-300 hover:bg-red-500/30",
                  )}
                >
                  Revoke
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
