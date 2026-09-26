"use client";

import { Loader2, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";

import { deleteDocument } from "@/app/library/actions";
import { Button } from "@/components/ui/button";

/** A delete button that asks "Delete?" first, so a mis-tap cannot lose a Document. */
export function DeleteDocument({ id, title }: { id: string; title: string }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string>();
  const [deleting, startDeleting] = useTransition();

  function confirmDelete() {
    setError(undefined);
    startDeleting(async () => {
      const result = await deleteDocument(id);
      if (result.error) setError(result.error);
    });
  }

  if (!confirming) {
    return (
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Delete ${title}`}
        onClick={() => setConfirming(true)}
      >
        <Trash2 />
      </Button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1" role="group" aria-label={`Delete ${title}?`}>
      <div className="flex items-center gap-2">
        <span className="text-sm">Delete?</span>
        <Button variant="outline" size="sm" disabled={deleting} onClick={() => setConfirming(false)}>
          Cancel
        </Button>
        <Button variant="destructive" size="sm" disabled={deleting} onClick={confirmDelete}>
          {deleting && <Loader2 className="animate-spin" />}
          Delete
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
