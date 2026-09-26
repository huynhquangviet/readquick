/** A one-to-one related row comes back from PostgREST as an object or as a one-item array. */
export function firstRelated<T>(related: T | T[] | null | undefined): T | undefined {
  return (Array.isArray(related) ? related[0] : related) ?? undefined;
}
