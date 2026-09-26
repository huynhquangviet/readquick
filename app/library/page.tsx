import { BookOpen } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { UploadDocument } from "@/components/upload-document";
import { createClient } from "@/lib/supabase/server";

async function Documents() {
  const supabase = await createClient();
  const { data: documents } = await supabase
    .from("documents")
    .select("id, title, word_count")
    .order("created_at", { ascending: false });

  if (!documents?.length) {
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

  return (
    <ul className="flex flex-col divide-y rounded-lg border">
      {documents.map((row) => (
        <li key={row.id}>
          <Link
            href={`/library/${row.id}`}
            className="flex items-baseline justify-between gap-4 p-4 hover:bg-accent"
          >
            <span className="font-medium">{row.title}</span>
            <span className="shrink-0 text-sm text-muted-foreground">
              {row.word_count.toLocaleString("en-US")} words
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function LibraryPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-bold text-2xl">Library</h1>
        <UploadDocument />
      </div>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <Documents />
      </Suspense>
    </div>
  );
}
