import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ReaderView } from "@/components/reader-view";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function Reader({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  // Row-level security means only the owner's Document comes back.
  const supabase = await createClient();
  const { data: row } = await supabase
    .from("documents")
    .select("title, document_texts(body, sentence_starts)")
    .eq("id", id)
    .maybeSingle();
  const text = Array.isArray(row?.document_texts) ? row.document_texts[0] : row?.document_texts;
  if (!row || !text) notFound();

  return (
    <>
      <h1 className="truncate font-bold text-lg">{row.title}</h1>
      <ReaderView body={text.body} sentenceStarts={text.sentence_starts} />
    </>
  );
}

export default function DocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <div className="flex flex-col gap-4">
      <Link href="/library" className="text-sm text-muted-foreground hover:underline">
        ← Library
      </Link>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <Reader params={params} />
      </Suspense>
    </div>
  );
}
