import { describe, expect, it } from "vitest";

import { checkUpload, contentHash } from "@/lib/library/upload-policy";

const bytes = (text: string) => new TextEncoder().encode(text);

describe("content hash", () => {
  it("is the SHA-256 of the file content, in hex", async () => {
    // The SHA-256 test vector for "abc" from FIPS 180-2.
    expect(await contentHash(bytes("abc"))).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});

const owned = (n: number, hashOf = (i: number) => `hash-${i}`) =>
  Array.from({ length: n }, (_, i) => ({ id: `doc-${i}`, contentHash: hashOf(i) }));

describe("checking an upload against the user's Library", () => {
  it("accepts content the user does not have yet", () => {
    expect(checkUpload({ hash: "new", existing: owned(3) })).toEqual({ status: "ok" });
  });

  it("recognises content the user already has, and names the existing Document", () => {
    const result = checkUpload({ hash: "hash-1", existing: owned(3) });
    expect(result).toMatchObject({ status: "duplicate", id: "doc-1" });
  });

  it("accepts a tenth Document", () => {
    expect(checkUpload({ hash: "new", existing: owned(9) })).toEqual({ status: "ok" });
  });

  it("refuses an eleventh Document and asks the user to delete one", () => {
    const result = checkUpload({ hash: "new", existing: owned(10) });
    expect(result.status).toBe("full");
    expect(result).toMatchObject({ message: expect.stringMatching(/delete/i) });
  });

  it("still opens the existing Document when a duplicate is uploaded with 10 in the Library", () => {
    expect(checkUpload({ hash: "hash-4", existing: owned(10) })).toMatchObject({
      status: "duplicate",
      id: "doc-4",
    });
  });
});
