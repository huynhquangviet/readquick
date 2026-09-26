import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import {
  MAX_FILE_BYTES,
  ingest,
  refusal,
  type IngestedDocument,
  type Refusal,
} from "@/lib/ingestion/ingest";
import { documentPath } from "@/lib/library/storage-path";
import {
  DUPLICATE_MESSAGE,
  FULL_MESSAGE,
  LIBRARY_FULL_ERROR,
  checkUpload,
  contentHash,
} from "@/lib/library/upload-policy";
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

// Re-uploading a file is not an error: the user is taken to the Document they already have.
function duplicateOf({ id, message }: { id: string; message: string }) {
  return NextResponse.json({ id, duplicate: true, message }, { status: 200 });
}

function libraryFull(message: string) {
  return NextResponse.json({ reason: "library-full", message }, { status: 409 });
}

function failed(message: string, status: number) {
  return NextResponse.json({ message }, { status });
}

type SaveResult =
  | { status: "saved"; id: string }
  | { status: "duplicate"; id: string; message: string }
  | { status: "full"; message: string }
  | { status: "failed" };

const UNIQUE_VIOLATION = "23505";
const CHECK_VIOLATION = "23514";

/**
 * Stores the original file and the extracted text. If any step fails, nothing
 * is left behind. The database enforces the two Library rules too (a unique
 * hash per user and the 10-Document cap), so two uploads at the same moment
 * cannot both get in; that outcome is reported the same way as the early check.
 */
async function saveDocument(
  supabase: SupabaseClient,
  userId: string,
  ingested: IngestedDocument,
  original: { bytes: Uint8Array; contentType: string; hash: string },
): Promise<SaveResult> {
  const id = crypto.randomUUID();
  const path = documentPath(userId, id, ingested.format);

  const { error: fileError } = await supabase.storage
    .from("documents")
    .upload(path, original.bytes, { contentType: original.contentType });
  if (fileError) return { status: "failed" };

  const { error: documentError } = await supabase.from("documents").insert({
    id,
    user_id: userId,
    title: ingested.title,
    format: ingested.format,
    word_count: ingested.words.length,
    content_hash: original.hash,
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
    return await classifyInsertFailure(supabase, documentError, original.hash);
  }
  return { status: "saved", id };
}

/** Turns a refused insert into the outcome the user should see. */
async function classifyInsertFailure(
  supabase: SupabaseClient,
  error: { code?: string; message?: string } | null,
  hash: string,
): Promise<SaveResult> {
  if (error?.code === CHECK_VIOLATION && error.message === LIBRARY_FULL_ERROR) {
    return { status: "full", message: FULL_MESSAGE };
  }
  if (error?.code === UNIQUE_VIOLATION) {
    const { data } = await supabase.from("documents").select("id").eq("content_hash", hash).maybeSingle();
    if (data) return { status: "duplicate", id: data.id, message: DUPLICATE_MESSAGE };
  }
  return { status: "failed" };
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

  // Both Library rules are checked here, before anything is stored, and again
  // by the database when the Document is added.
  const hash = await contentHash(bytes);
  const { data: owned } = await supabase.from("documents").select("id, content_hash");
  if (!owned) return failed("Your Document could not be saved. Please try again.", 500);
  const check = checkUpload({
    hash,
    existing: owned.map((row) => ({ id: row.id, contentHash: row.content_hash })),
  });
  if (check.status === "duplicate") return duplicateOf(check);
  if (check.status === "full") return libraryFull(check.message);

  const saved = await saveDocument(supabase, userId, result.document, {
    bytes,
    contentType: file.type || "text/plain",
    hash,
  });
  switch (saved.status) {
    case "saved":
      return NextResponse.json({ id: saved.id }, { status: 201 });
    case "duplicate":
      return duplicateOf(saved);
    case "full":
      return libraryFull(saved.message);
    case "failed":
      return failed("Your Document could not be saved. Please try again.", 500);
  }
}
