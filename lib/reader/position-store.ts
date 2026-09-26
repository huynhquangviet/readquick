import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Returns a function that stores the Reading position of one Document. Writes
 * go out one after another, so a slow earlier write cannot land after a later
 * one and undo it: the most recent write wins. A failed write rejects, which
 * the position saver answers by trying again.
 */
export function createPositionWriter(supabase: SupabaseClient, documentId: string) {
  let queue: Promise<unknown> = Promise.resolve();
  return (position: number): Promise<void> => {
    const write = queue.then(async () => {
      const { error } = await supabase
        .from("reading_positions")
        .upsert({ document_id: documentId, word_index: position }, { onConflict: "document_id" });
      if (error) throw error;
    });
    queue = write.catch(() => undefined);
    return write;
  };
}
