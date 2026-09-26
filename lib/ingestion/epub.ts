import { unzipSync, strFromU8 } from "fflate";
import { isTag, isText, type ChildNode, type Element } from "domhandler";
import { DomUtils, parseDocument } from "htmlparser2";

import type { Chapter } from "./ingest";
import { toWords } from "./words";

export interface EpubContent {
  /** The title in the EPUB metadata, if it has one. */
  title?: string;
  words: string[];
  chapters: Chapter[];
}

export type EpubFailure = "corrupt" | "protected";

// Elements that do not break a Word or a line when they end.
const INLINE = new Set([
  "a", "abbr", "b", "bdi", "bdo", "big", "cite", "code", "del", "dfn", "em", "font", "i", "ins",
  "kbd", "mark", "q", "rp", "rt", "ruby", "s", "samp", "small", "span", "strike", "strong", "sub",
  "sup", "time", "tt", "u", "var", "wbr",
]);

// Elements whose content is not prose. Images have no text of their own; tables
// and the rest are left out because they do not read as a stream of Words.
const NOT_PROSE = new Set([
  "head", "img", "table", "svg", "math", "script", "style", "noscript", "object",
  "audio", "video", "canvas", "iframe",
]);

// The parts of an EPUB that are read: markup and metadata, not images, fonts or styles.
const READ_PARTS = /\.(x?html?|xml|opf|ncx)$/iu;
// A generous ceiling on the unpacked text of a book (the upload limit is 5MB zipped).
const MAX_UNPACKED_BYTES = 50 * 1024 * 1024;

// Font obfuscation is not DRM: it only ties an embedded font to the book's identifier.
const FONT_OBFUSCATION = new Set([
  "http://www.idpf.org/2008/embedding",
  "http://ns.adobe.com/pdf/enc#RC",
]);

/** True if the EPUB is locked by DRM: Adobe or Apple rights information, or encrypted parts other than fonts. */
function isProtected(files: Record<string, Uint8Array>): boolean {
  if (files["META-INF/rights.xml"] || files["META-INF/sinf.xml"]) return true;
  const encryption = files["META-INF/encryption.xml"];
  if (!encryption) return false;
  return DomUtils.findAll(
    (e) => e.name.endsWith("EncryptionMethod") && !FONT_OBFUSCATION.has(e.attribs.Algorithm),
    parseXml(strFromU8(encryption)).children,
  ).length > 0;
}

// Spreading a long array into push() overflows the stack, so append one by one.
function append(target: string[], items: string[]) {
  for (const item of items) target.push(item);
}

function parseXml(text: string) {
  return parseDocument(text, { xmlMode: true });
}

function attr(element: Element, name: string): string | undefined {
  return element.attribs[name];
}

/** Decodes %-escapes in a file name; a stray "%" is kept as it is. */
function decode(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

/** Resolves an href written relative to the file at `from`. */
function resolvePath(from: string, href: string): string {
  const parts = from.split("/").slice(0, -1);
  for (const part of decode(href.split("#")[0]).split("/")) {
    if (part === "..") parts.pop();
    else if (part !== "." && part !== "") parts.push(part);
  }
  return parts.join("/");
}

interface Prose {
  words: string[];
  /** For each element id, the index (within `words`) of the Word at which it appears. */
  anchors: Map<string, number>;
}

/** The Words of an XHTML file, with a break wherever a block starts or ends. */
function proseOf(nodes: ChildNode[]): Prose {
  const words: string[] = [];
  const anchors = new Map<string, number>();
  // Text since the last whole Word; inline markup can split a Word ("a<em>b</em>").
  let pending = "";

  function emit(text: string) {
    pending += text;
    const cut = pending.search(/\S*$/u);
    append(words, toWords(pending.slice(0, cut)));
    pending = pending.slice(cut);
  }

  function walk(children: ChildNode[]) {
    for (const node of children) {
      if (isText(node)) {
        emit(node.data);
      } else if (isTag(node) && !NOT_PROSE.has(node.name.toLowerCase())) {
        const block = !INLINE.has(node.name.toLowerCase());
        if (block) emit(" ");
        const id = node.attribs.id;
        // A Word still in progress comes before the id, so the id is at the Word after it.
        if (id !== undefined && !anchors.has(id)) anchors.set(id, words.length + (pending ? 1 : 0));
        walk(node.children);
        if (block) emit(" ");
      }
    }
  }

  walk(nodes);
  emit(" ");
  return { words, anchors };
}

/** A table of contents entry: where it points, and what it is called. */
interface TocEntry {
  title: string;
  path: string;
  fragment?: string;
}

function target(from: string, href: string): Pick<TocEntry, "path" | "fragment"> {
  const hash = href.indexOf("#");
  return {
    path: resolvePath(from, href),
    fragment: hash >= 0 ? decode(href.slice(hash + 1)) : undefined,
  };
}

/** EPUB 2: the <navPoint> entries of the NCX file, each with a label and a target. */
function ncxEntries(path: string, xml: string): TocEntry[] {
  return DomUtils.findAll((e) => e.name === "navPoint", parseXml(xml).children).flatMap((point) => {
    const label = DomUtils.findOne((e) => e.name === "text", point.children, true);
    const content = DomUtils.findOne((e) => e.name === "content", point.children, true);
    const src = content && attr(content, "src");
    return label && src ? [{ title: DomUtils.textContent(label), ...target(path, src) }] : [];
  });
}

/** EPUB 3: the links inside the <nav epub:type="toc"> of the navigation document. */
function navEntries(path: string, html: string): TocEntry[] {
  const document = parseDocument(html, { xmlMode: true });
  const nav = DomUtils.findOne(
    (e) => e.name === "nav" && (e.attribs["epub:type"] ?? "").split(/\s+/u).includes("toc"),
    document.children,
    true,
  );
  if (!nav) return [];
  return DomUtils.findAll((e) => e.name === "a" && e.attribs.href !== undefined, nav.children).map(
    (a) => ({ title: DomUtils.textContent(a), ...target(path, a.attribs.href) }),
  );
}

/** Reads an EPUB. Anything unexpected in a damaged file counts as an EPUB that could not be read. */
export function readEpub(bytes: Uint8Array): EpubContent | EpubFailure {
  try {
    return readPackage(bytes);
  } catch {
    return "corrupt";
  }
}

function readPackage(bytes: Uint8Array): EpubContent | EpubFailure {
  let files: Record<string, Uint8Array>;
  try {
    let unpacked = 0;
    files = unzipSync(bytes, {
      // Only the text parts are needed, and a small file must not unpack into a huge one.
      filter: ({ name, originalSize }) => {
        if (!READ_PARTS.test(name)) return false;
        unpacked += originalSize;
        if (unpacked > MAX_UNPACKED_BYTES) throw new Error("unpacks to too much text");
        return true;
      },
    });
  } catch {
    return "corrupt";
  }
  if (isProtected(files)) return "protected";
  const read = (path: string) => (files[path] ? strFromU8(files[path]) : undefined);

  const container = read("META-INF/container.xml");
  if (container === undefined) return "corrupt";
  const rootfile = DomUtils.findOne(
    (e) => e.name === "rootfile",
    parseXml(container).children,
    true,
  );
  const opfPath = rootfile && attr(rootfile, "full-path");
  const opf = opfPath ? read(opfPath) : undefined;
  if (!opfPath || opf === undefined) return "corrupt";

  const opfDocument = parseXml(opf);
  const items = DomUtils.findAll((e) => e.name === "item", opfDocument.children).flatMap((item) => {
    const id = attr(item, "id");
    const href = attr(item, "href");
    return id && href
      ? [
          {
            id,
            path: resolvePath(opfPath, href),
            properties: attr(item, "properties") ?? "",
            mediaType: attr(item, "media-type") ?? "",
          },
        ]
      : [];
  });
  const pathById = new Map(items.map((item) => [item.id, item.path]));
  const spine = DomUtils.findAll((e) => e.name === "itemref", opfDocument.children)
    .map((itemref) => pathById.get(attr(itemref, "idref") ?? ""))
    .filter((path): path is string => path !== undefined);

  const words: string[] = [];
  // Where each spine file starts in the Word stream, and where its ids fall.
  const starts = new Map<string, { start: number; anchors: Map<string, number> }>();
  for (const path of spine) {
    const html = read(path);
    if (html === undefined) continue;
    // Self-closing tags are legal in XHTML (<script/>), but plain HTML would read them as open.
    const page = parseDocument(html, { recognizeSelfClosing: true });
    const body = DomUtils.findOne((e) => e.name === "body", page.children, true);
    const prose = proseOf(body ? body.children : page.children);
    starts.set(path, { start: words.length, anchors: prose.anchors });
    append(words, prose.words);
  }

  const navItem = items.find((item) => item.properties.split(/\s+/u).includes("nav"));
  const navHtml = navItem && read(navItem.path);
  let entries = navItem && navHtml !== undefined ? navEntries(navItem.path, navHtml) : [];
  if (entries.length === 0) {
    const ncxItem = items.find((item) => item.mediaType === "application/x-dtbncx+xml");
    const ncx = ncxItem && read(ncxItem.path);
    if (ncxItem && ncx !== undefined) entries = ncxEntries(ncxItem.path, ncx);
  }
  const chapters: Chapter[] = [];
  for (const entry of entries) {
    const section = starts.get(entry.path);
    const title = entry.title.replace(/\s+/gu, " ").trim();
    if (!section || !title) continue;
    const wordIndex = section.start + ((entry.fragment && section.anchors.get(entry.fragment)) || 0);
    // A Chapter with no text after it has nothing to jump to.
    if (wordIndex < words.length) chapters.push({ title, wordIndex });
  }

  chapters.sort((a, b) => a.wordIndex - b.wordIndex);

  const titleElement = DomUtils.findOne((e) => e.name === "dc:title", opfDocument.children, true);
  const title = titleElement && DomUtils.textContent(titleElement).trim();
  return { title: title || undefined, words, chapters };
}
