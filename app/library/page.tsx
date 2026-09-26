import { BookOpen } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { DeleteDocument } from "@/components/delete-document";
import { UploadDocument } from "@/components/upload-document";
import { Button } from "@/components/ui/button";
import { lastReadLabel, percentRead } from "@/lib/library/summary";
import { firstRelated } from "@/lib/supabase/related";
import { createClient } from "@/lib/supabase/server";

async function Documents() {
  const supabase = await createClient();
  const { data: documents, error } = await supabase
    .from("documents")
    .select("id, title, word_count, reading_positions(word_index, updated_at)")
    .order("created_at", { ascending: false });

  // A failed load must not look like an empty Library.
  if (error || !documents) {
    return (
      <p role="alert" className="text-sm text-destructive">
        Your Library could not be loaded. Please try again.
      </p>
    );
  }

  if (!documents.length) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-10 text-center">
        <BookOpen className="text-muted-foreground" size={32} />
        <p className="font-medium">Your Library is empty</p>
        <p className="text-sm text-muted-foreground">
          Upload a Document to start reading.
        </p>
      </div>
    );
  }

  const now = new Date();
  return (
    <ul className="flex flex-col divide-y rounded-lg border">
      {documents.map((row) => {
        const position = firstRelated(row.reading_positions);
        const percent = percentRead(position?.word_index ?? 0, row.word_count);
        return (
          <li key={row.id} className="flex items-center gap-2 pr-2 hover:bg-accent">
            <Link href={`/library/${row.id}`} className="flex min-w-0 flex-1 flex-col gap-2 p-4">
              <span className="truncate font-medium">{row.title}</span>
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                <span>{percent}% read</span>
                <span>{lastReadLabel(position ? new Date(position.updated_at) : null, now)}</span>
                <span>{row.word_count.toLocaleString("en-US")} words</span>
              </span>
              <span
                role="progressbar"
                aria-label="Read"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percent}
                className="h-1 w-full overflow-hidden rounded-full bg-muted"
              >
                <span className="block h-full bg-foreground/60" style={{ width: `${percent}%` }} />
              </span>
            </Link>
            <DeleteDocument id={row.id} title={row.title} />
          </li>
        );
      })}
    </ul>
  );
}

export default function LibraryPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-bold text-2xl">Library</h1>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/library/stats">Stats</Link>
          </Button>
          <UploadDocument />
        </div>
      </div>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <Documents />
      </Suspense>
    </div>
  );
}
