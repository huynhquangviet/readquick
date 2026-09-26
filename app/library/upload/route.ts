import { NextResponse } from "next/server";

import { MAX_FILE_BYTES, ingest, refusal } from "@/lib/ingestion/ingest";
import { createClient } from "@/lib/supabase/server";

// A multipart body is a little bigger than the file inside it.
const MULTIPART_ALLOWANCE_BYTES = 64 * 1024;

const REFUSAL_STATUS = {
  "too-large": 413,
  "unsupported-format": 415,
  corrupt: 422,
} as const;

function refused(result: ReturnType<typeof refusal>) {
  if (result.ok) throw new Error("expected a refusal");
  return NextResponse.json(
    { reason: result.reason, message: result.message },
    { status: REFUSAL_STATUS[result.reason] },
  );
}

function failed(message: string, status: number) {
  return NextResponse.json({ message }, { status });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (!userId) return failed("Sign in to upload a Document.", 401);

  // Refuse an oversized upload before reading it.
  const declaredBytes = Number(request.headers.get("content-length") ?? 0);
  if (declaredBytes > MAX_FILE_BYTES + MULTIPART_ALLOWANCE_BYTES) {
    return refused(refusal("too-large"));
  }

  const file = (await request.formData()).get("file");
  if (!(file instanceof File)) return refused(refusal("corrupt"));

  const bytes = new Uint8Array(await file.arrayBuffer());
  const result = ingest({ bytes, filename: file.name });
  if (!result.ok) return refused(result);
  const { document } = result;

  const id = crypto.randomUUID();
  const path = `${userId}/${id}.${document.format}`;
  const unsaved = "Your Document could not be saved. Please try again.";

  const { error: fileError } = await supabase.storage
    .from("documents")
    .upload(path, bytes, { contentType: file.type || "text/plain" });
  if (fileError) return failed(unsaved, 500);

  const { error: documentError } = await supabase.from("documents").insert({
    id,
    user_id: userId,
    title: document.title,
    format: document.format,
    word_count: document.words.length,
  });
  const { error: textError } = documentError
    ? { error: documentError }
    : await supabase.from("document_texts").insert({
        document_id: id,
        user_id: userId,
        body: document.words.join(" "),
        sentence_starts: document.sentenceStarts,
        chapters: document.chapters,
      });

  if (documentError || textError) {
    // Leave nothing behind: deleting the Document also deletes its text.
    await supabase.from("documents").delete().eq("id", id);
    await supabase.storage.from("documents").remove([path]);
    return failed(unsaved, 500);
  }

  return NextResponse.json({ id }, { status: 201 });
}
