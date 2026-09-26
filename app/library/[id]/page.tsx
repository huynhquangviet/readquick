import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ReaderView } from "@/components/reader-view";
import { isDocumentId } from "@/lib/library/document-id";
import { firstRelated } from "@/lib/supabase/related";
import { createClient } from "@/lib/supabase/server";

async function Reader({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ duplicate?: string }>;
}) {
  const { id } = await params;
  if (!isDocumentId(id)) notFound();
  const { duplicate } = await searchParams;

  // Row-level security means only the owner's Document comes back.
  const supabase = await createClient();
  const { data: row } = await supabase
    .from("documents")
    .select("title, document_texts(body, sentence_starts), reading_positions(word_index)")
    .eq("id", id)
    .maybeSingle();
  const text = firstRelated(row?.document_texts);
  if (!row || !text) notFound();
  const position = firstRelated(row.reading_positions);

  return (
    <>
      <h1 className="truncate font-bold text-lg">{row.title}</h1>
      {duplicate && (
        <p role="status" className="rounded-lg border p-3 text-sm text-muted-foreground">
          You already had this Document, so it was not added again. You are back where you left off.
        </p>
      )}
      <ReaderView
        key={id}
        documentId={id}
        body={text.body}
        sentenceStarts={text.sentence_starts}
        initialPosition={position?.word_index ?? 0}
      />
    </>
  );
}

export default function DocumentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ duplicate?: string }>;
}) {
  return (
    <div className="flex flex-col gap-4">
      <Link href="/library" className="text-sm text-muted-foreground hover:underline">
        ← Library
      </Link>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <Reader params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
