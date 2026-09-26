import { notFound } from "next/navigation";
import { Suspense } from "react";

import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function DocumentSummary({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  // Row-level security means only the owner's Document comes back.
  const supabase = await createClient();
  const { data: document } = await supabase
    .from("documents")
    .select("title, word_count")
    .eq("id", id)
    .maybeSingle();
  if (!document) notFound();

  return (
    <>
      <h1 className="font-bold text-2xl">{document.title}</h1>
      <p className="text-muted-foreground">
        {document.word_count.toLocaleString("en-US")} words
      </p>
    </>
  );
}

export default function DocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <DocumentSummary params={params} />
      </Suspense>
    </div>
  );
}
