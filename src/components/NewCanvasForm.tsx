import { useState } from "react";
import { Button } from "@/components/ui/button";

type Status = "idle" | "loading" | "error";

export default function NewCanvasForm() {
  const [idea, setIdea] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    setStatus("loading");
    try {
      const res = await fetch("/api/canvases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea }),
      });
      if (res.status === 201) {
        const data = (await res.json()) as { id: string };
        window.location.href = `/canvas/${data.id}`;
      } else {
        let msg = "Failed to generate canvas. Please try again.";
        try {
          const err = (await res.json()) as { error?: string };
          if (err.error) msg = err.error;
        } catch {
          // use fallback message
        }
        setErrorMessage(msg);
        setStatus("error");
      }
    } catch {
      setErrorMessage("Network error. Please check your connection and try again.");
      setStatus("error");
    }
  }

  const isLoading = status === "loading";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <textarea
        value={idea}
        onChange={(e) => {
          setIdea(e.target.value);
        }}
        disabled={isLoading}
        placeholder="Describe your business idea…"
        rows={6}
        className="w-full resize-none rounded-lg border border-white/10 bg-white/5 p-4 text-white placeholder-white/40 focus:ring-2 focus:ring-white/20 focus:outline-none disabled:opacity-50"
      />
      <Button type="submit" disabled={isLoading} className="self-start">
        {isLoading ? "Generating…" : "Generate my canvas"}
      </Button>
      {status === "error" && <p className="text-sm text-red-400">{errorMessage}</p>}
    </form>
  );
}
