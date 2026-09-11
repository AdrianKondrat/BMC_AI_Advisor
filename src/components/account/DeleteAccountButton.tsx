import { useState } from "react";
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
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

export default function DeleteAccountButton() {
  const [checkboxChecked, setCheckboxChecked] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/delete-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        let errorMsg = "Failed to delete account";
        try {
          const data = (await response.json()) as Record<string, unknown>;
          if (typeof data.error === "string") {
            errorMsg = data.error;
          }
        } catch {
          // Ignore JSON parse error
        }
        throw new Error(errorMsg);
      }

      // Redirect to sign-in with deleted notice
      window.location.href = "/auth/signin?deleted=true";
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      setIsDeleting(false);
    }
  };

  return (
    <div>
      {error && <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-200">{error}</div>}
      <div className="mb-4 flex items-center gap-2">
        <Checkbox
          id="delete-confirm"
          checked={checkboxChecked}
          onCheckedChange={(checked) => {
            setCheckboxChecked(checked === true);
          }}
        />
        <label htmlFor="delete-confirm" className="cursor-pointer text-sm text-white/70">
          I understand this is permanent
        </label>
      </div>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" disabled={!checkboxChecked || isDeleting}>
            {isDeleting ? "Deleting..." : "Delete Account"}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Account?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete your account and all associated canvases, blocks, and share links. This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
