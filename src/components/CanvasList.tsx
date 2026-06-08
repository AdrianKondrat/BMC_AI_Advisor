import { useState } from "react";
import type { CanvasSummary } from "@/types";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Props {
  canvases: CanvasSummary[];
}

export default function CanvasList({ canvases: initial }: Props) {
  const [canvases, setCanvases] = useState<CanvasSummary[]>(initial);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete(id: string) {
    setError(null);
    const res = await fetch(`/api/canvases/${id}`, { method: "DELETE" });
    if (res.ok) {
      setCanvases((prev) => prev.filter((c) => c.id !== id));
    } else {
      setError("Failed to delete canvas. Please try again.");
    }
  }

  if (canvases.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center text-white/70">
        <span className="text-5xl">🗂️</span>
        <h2 className="text-xl font-semibold text-white">No canvases yet</h2>
        <Button disabled>Create your first canvas</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <p className="rounded-md bg-red-500/20 px-4 py-2 text-sm text-red-300">{error}</p>}
      {canvases.map((canvas) => (
        <div
          key={canvas.id}
          className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-5 py-4"
        >
          <div>
            <p className="font-medium text-white">{canvas.name || "Untitled canvas"}</p>
            <p className="mt-0.5 text-sm text-white/50">{new Date(canvas.created_at).toLocaleDateString()}</p>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete canvas?</AlertDialogTitle>
                <AlertDialogDescription>Are you sure? This cannot be undone.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction variant="destructive" onClick={() => handleDelete(canvas.id)}>
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      ))}
    </div>
  );
}
