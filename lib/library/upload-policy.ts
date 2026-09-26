/** SHA-256 of the file content as lower-case hex: two uploads of the same content give the same hash. */
export async function contentHash(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export interface OwnedDocument {
  id: string;
  /** Documents uploaded before duplicate detection have no hash. They still count towards the cap. */
  contentHash: string | null;
}

export type UploadCheck =
  /** The Document may be added. */
  | { status: "ok" }
  /** The user already has this content: open the existing Document instead. */
  | { status: "duplicate"; id: string; message: string }
  /** The Library is at its cap: the user has to delete a Document first. */
  | { status: "full"; message: string };

// The database enforces the same cap in a trigger (supabase/migrations), so change both.
export const MAX_DOCUMENTS = 10;

/** What the database's cap trigger raises; the upload route recognises a full Library by it. */
export const LIBRARY_FULL_ERROR = "library_full";

export const DUPLICATE_MESSAGE = "You already have this Document. Opening it now.";
export const FULL_MESSAGE = `Your Library is full. The limit is ${MAX_DOCUMENTS} Documents; delete one to upload another.`;

/** Decides whether an upload may add a Document, given the Documents the user already has. */
export function checkUpload({ hash, existing }: { hash: string; existing: OwnedDocument[] }): UploadCheck {
  const same = existing.find((owned) => owned.contentHash === hash);
  if (same) return { status: "duplicate", id: same.id, message: DUPLICATE_MESSAGE };
  if (existing.length >= MAX_DOCUMENTS) return { status: "full", message: FULL_MESSAGE };
  return { status: "ok" };
}
