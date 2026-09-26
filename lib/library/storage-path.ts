/** Where a Document's original file lives in the private `documents` bucket. */
export function documentPath(userId: string, documentId: string, format: string): string {
  return `${userId}/${documentId}.${format}`;
}
