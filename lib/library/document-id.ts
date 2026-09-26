const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A Document's id is a UUID; anything else cannot be one, so there is no need to ask the database. */
export function isDocumentId(value: string): boolean {
  return UUID.test(value);
}
