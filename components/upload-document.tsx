"use client";

import { Loader2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";

const GENERIC_ERROR = "Your Document could not be uploaded. Please try again.";

export function UploadDocument() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string>();

  async function upload(file: File) {
    setUploading(true);
    setError(undefined);
    try {
      const body = new FormData();
      body.set("file", file);
      const response = await fetch("/library/upload", { method: "POST", body });
      const result = await response.json().catch(() => undefined);
      if (response.ok && result?.id) {
        // Stay in the loading state until the Document page takes over.
        // A duplicate opens the Document the user already has, and says so there.
        router.push(`/library/${result.id}${result.duplicate ? "?duplicate=1" : ""}`);
        return;
      }
      setError(result?.message ?? GENERIC_ERROR);
    } catch {
      setError(GENERIC_ERROR);
    }
    setUploading(false);
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <input
        ref={input}
        type="file"
        className="sr-only"
        tabIndex={-1}
        aria-label="Choose a Document to upload"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void upload(file);
        }}
      />
      <Button onClick={() => input.current?.click()} disabled={uploading}>
        {uploading ? (
          <Loader2 className="animate-spin" size={16} />
        ) : (
          <Upload size={16} />
        )}
        {uploading ? "Processing…" : "Upload Document"}
      </Button>
      <p role="status" className="sr-only">
        {uploading ? "Processing your Document" : ""}
      </p>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
