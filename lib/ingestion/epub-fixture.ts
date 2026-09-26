import { strToU8, zipSync } from "fflate";

// Builds small EPUBs in memory for the Ingestion tests.

export interface FixtureSection {
  /** File name inside the EPUB, e.g. "ch1.xhtml". */
  href: string;
  /** Markup inside <body>. */
  body: string;
}

export interface FixtureTocEntry {
  title: string;
  /** Target relative to the package, e.g. "ch2.xhtml#part-two". */
  href: string;
}

export interface FixtureOptions {
  title?: string;
  sections: FixtureSection[];
  /** The table of contents, as an EPUB 3 nav document or an EPUB 2 NCX. */
  toc?: { style: "nav" | "ncx"; entries: FixtureTocEntry[] };
  /** Extra files, e.g. META-INF/encryption.xml. */
  files?: Record<string, string>;
}

const CONTAINER = `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`;

function page(body: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml"><head><title>x</title></head><body>${body}</body></html>`;
}

function navDocument(entries: FixtureTocEntry[]): string {
  const items = entries.map((e) => `<li><a href="${e.href}">${e.title}</a></li>`).join("");
  return `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>Contents</title></head>
<body><nav epub:type="toc"><h1>Contents</h1><ol>${items}</ol></nav></body></html>`;
}

function ncxDocument(entries: FixtureTocEntry[]): string {
  const points = entries
    .map(
      (e, i) =>
        `<navPoint id="p${i}" playOrder="${i + 1}"><navLabel><text>${e.title}</text></navLabel><content src="${e.href}"/></navPoint>`,
    )
    .join("");
  return `<?xml version="1.0"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1"><navMap>${points}</navMap></ncx>`;
}

export function epub({ title, sections, toc, files = {} }: FixtureOptions): Uint8Array {
  const tocItem = !toc
    ? ""
    : toc.style === "nav"
      ? `<item id="toc" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>`
      : `<item id="toc" href="toc.ncx" media-type="application/x-dtbncx+xml"/>`;
  const manifest =
    sections
      .map((s, i) => `<item id="s${i}" href="${s.href}" media-type="application/xhtml+xml"/>`)
      .join("") + tocItem;
  const spine = sections.map((_, i) => `<itemref idref="s${i}"/>`).join("");
  const spineAttributes = toc?.style === "ncx" ? ' toc="toc"' : "";
  const opf = `<?xml version="1.0"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">${title ? `<dc:title>${title}</dc:title>` : ""}</metadata>
  <manifest>${manifest}</manifest>
  <spine${spineAttributes}>${spine}</spine>
</package>`;

  const entries: Record<string, Uint8Array> = {
    mimetype: strToU8("application/epub+zip"),
    "META-INF/container.xml": strToU8(CONTAINER),
    "OEBPS/content.opf": strToU8(opf),
  };
  if (toc) {
    entries[toc.style === "nav" ? "OEBPS/nav.xhtml" : "OEBPS/toc.ncx"] = strToU8(
      toc.style === "nav" ? navDocument(toc.entries) : ncxDocument(toc.entries),
    );
  }
  for (const s of sections) entries[`OEBPS/${s.href}`] = strToU8(page(s.body));
  for (const [path, content] of Object.entries(files)) entries[path] = strToU8(content);
  return zipSync(entries);
}
