// Inline reference tokens in message content.
//
// Wire formats (embedded inside plain text):
//   [[page/<id>|<label>]]
//   [[file/<id>|<label>]]
//   @[<node_id>|<label>]
//
// Keeping the id in the token lets us follow renames without broken links,
// while the label gives a readable fallback if the target was deleted.

export type RefToken =
  | { kind: "page"; id: string; label: string; raw: string }
  | { kind: "file"; id: string; label: string; raw: string }
  | { kind: "mention"; id: string; label: string; raw: string };

export type ContentSegment =
  | { kind: "text"; text: string }
  | { kind: "ref"; token: RefToken };

const TOKEN_RE =
  /\[\[(page|file)\/([A-Za-z0-9_-]+)\|([^\]]+)\]\]|@\[([A-Za-z0-9_-]+)\|([^\]]+)\]/g;

export function parseContent(content: string): ContentSegment[] {
  const out: ContentSegment[] = [];
  let last = 0;
  for (const match of content.matchAll(TOKEN_RE)) {
    const start = match.index ?? 0;
    if (start > last) {
      out.push({ kind: "text", text: content.slice(last, start) });
    }
    if (match[1]) {
      const kind = match[1] as "page" | "file";
      out.push({
        kind: "ref",
        token: {
          kind,
          id: match[2],
          label: match[3],
          raw: match[0],
        },
      });
    } else {
      out.push({
        kind: "ref",
        token: {
          kind: "mention",
          id: match[4],
          label: match[5],
          raw: match[0],
        },
      });
    }
    last = start + match[0].length;
  }
  if (last < content.length) {
    out.push({ kind: "text", text: content.slice(last) });
  }
  return out;
}

export function formatPageRef(id: string, label: string): string {
  return `[[page/${id}|${label.replace(/[\|\]]/g, "")}]]`;
}
export function formatFileRef(id: string, label: string): string {
  return `[[file/${id}|${label.replace(/[\|\]]/g, "")}]]`;
}
export function formatMention(id: string, label: string): string {
  return `@[${id}|${label.replace(/[\|\]]/g, "")}]`;
}
