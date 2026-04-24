import { useDuochat } from "../../lib/store";
import { parseContent } from "./refs";
import { colorFor, shortId } from "../../lib/util";

export function MessageContent({ content }: { content: string }) {
  const { setSidePanel, identity } = useDuochat();
  const segments = parseContent(content);

  return (
    <span className="whitespace-pre-wrap break-words">
      {segments.map((seg, i) => {
        if (seg.kind === "text") return <span key={i}>{seg.text}</span>;
        const t = seg.token;
        if (t.kind === "page") {
          return (
            <button
              key={i}
              onClick={() => setSidePanel({ kind: "page", id: t.id })}
              className="mx-0.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-duo-accent/15 text-duo-accent hover:bg-duo-accent/25 text-[12px] align-baseline"
            >
              📄 {t.label}
            </button>
          );
        }
        if (t.kind === "file") {
          return (
            <button
              key={i}
              onClick={() => setSidePanel({ kind: "file", id: t.id })}
              className="mx-0.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-duo-border/50 hover:bg-duo-border text-[12px] align-baseline"
            >
              📎 {t.label}
            </button>
          );
        }
        // mention
        const isSelf = identity?.author_id === t.id;
        return (
          <span
            key={i}
            className="mx-0.5 inline-flex items-center px-1.5 py-0.5 rounded text-[12px] align-baseline font-medium"
            style={{
              backgroundColor: `${colorFor(t.id)}22`,
              color: colorFor(t.id),
            }}
          >
            @{isSelf ? "you" : t.label || shortId(t.id, 4)}
          </span>
        );
      })}
    </span>
  );
}
