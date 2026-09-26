import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import {
  MAX_FILE_BYTES,
  ingest,
  refusal,
  type IngestedDocument,
  type Refusal,
} from "@/lib/ingestion/ingest";
import { createClient } from "@/lib/supabase/server";

// A multipart body is a little bigger than the file inside it.
const MULTIPART_ALLOWANCE_BYTES = 64 * 1024;

const REFUSAL_STATUS = {
  "too-large": 413,
  "unsupported-format": 415,
  corrupt: 422,
} as const;

function refused({ reason, message }: Refusal) {
  return NextResponse.json({ reason, message }, { status: REFUSAL_STATUS[reason] });
}

function failed(message: string, status: number) {
  return NextResponse.json({ message }, { status });
}

/**
 * Stores the original file and the extracted text. If any step fails, nothing
 * is left behind. Returns the new Document's id, or undefined on failure.
 */
async function saveDocument(
  supabase: SupabaseClient,
  userId: string,
  ingested: IngestedDocument,
  original: { bytes: Uint8Array; contentType: string },
): Promise<string | undefined> {
  const id = crypto.randomUUID();
  const path = `${userId}/${id}.${ingested.format}`;

  const { error: fileError } = await supabase.storage
    .from("documents")
    .upload(path, original.bytes, { contentType: original.contentType });
  if (fileError) return undefined;

  const { error: documentError } = await supabase.from("documents").insert({
    id,
    user_id: userId,
    title: ingested.title,
    format: ingested.format,
    word_count: ingested.words.length,
  });
  const { error: textError } = documentError
    ? { error: documentError }
    : await supabase.from("document_texts").insert({
        document_id: id,
        user_id: userId,
        body: ingested.words.join(" "),
        sentence_starts: ingested.sentenceStarts,
        chapters: ingested.chapters,
      });

  if (documentError || textError) {
    // Deleting the Document also deletes its text.
    await supabase.from("documents").delete().eq("id", id);
    await supabase.storage.from("documents").remove([path]);
    return undefined;
  }
  return id;
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

  // A body that is not a well-formed upload is a file that could not be read.
  const file = await request
    .formData()
    .then((form) => form.get("file"))
    .catch(() => null);
  if (!(file instanceof File)) return refused(refusal("corrupt"));

  const bytes = new Uint8Array(await file.arrayBuffer());
  const result = ingest({ bytes, filename: file.name });
  if (!result.ok) return refused(result);

  const id = await saveDocument(supabase, userId, result.document, {
    bytes,
    contentType: file.type || "text/plain",
  });
  if (!id) return failed("Your Document could not be saved. Please try again.", 500);

  return NextResponse.json({ id }, { status: 201 });
}
