import type { SupabaseClient } from "@supabase/supabase-js";

import type { ActivityRecord } from "@/lib/reader/activity-recorder";

/**
 * Returns a function that adds reading activity to the row of the user's local
 * date. The database adds to what is there, so the order of sends does not
 * matter. A failed send rejects, which the activity recorder answers by
 * sending it again with the next one.
 */
export function createActivityWriter(supabase: SupabaseClient) {
  return async ({ date, seconds, wordsRead }: ActivityRecord): Promise<void> => {
    const { error } = await supabase.rpc("record_reading_activity", {
      p_day: date,
      p_seconds: seconds,
      p_words: wordsRead,
    });
    if (error) throw error;
  };
}
