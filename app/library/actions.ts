"use server";

import { revalidatePath } from "next/cache";

import { isDocumentId } from "@/lib/library/document-id";
import { documentPath } from "@/lib/library/storage-path";
import { createClient } from "@/lib/supabase/server";

const FAILED = "Your Document could not be deleted. Please try again.";

/**
 * Deletes a Document: its original file, and the Document row, which takes its
 * extracted text and Reading position with it. The file goes first, so if
 * anything fails the Document is still in the Library and can be deleted again.
 * Row-level security means a user can only ever find their own Documents.
 */
export async function deleteDocument(id: string): Promise<{ error?: string }> {
  if (!isDocumentId(id)) return { error: FAILED };

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (!userId) return { error: "Sign in to delete a Document." };

  const { data: row } = await supabase.from("documents").select("format").eq("id", id).maybeSingle();
  // Not the user's, or already gone: nothing to delete, and nothing to tell apart.
  if (!row) {
    revalidatePath("/library");
    return {};
  }

  const { error: fileError } = await supabase.storage
    .from("documents")
    .remove([documentPath(userId, id, row.format)]);
  if (fileError) return { error: FAILED };

  const { error } = await supabase.from("documents").delete().eq("id", id);
  if (error) return { error: FAILED };

  revalidatePath("/library");
  return {};
}
