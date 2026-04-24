import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { useDuochat } from "../../lib/store";
import { cmd } from "../../lib/tauri";
import {
  formatFileRef,
  formatMention,
  formatPageRef,
} from "./refs";

type TriggerKind = "ref" | "mention" | "slash";

interface Trigger {
  kind: TriggerKind;
  query: string;
  start: number; // index in text where the trigger starts (inclusive)
}

interface Suggestion {
  id: string;
  label: string;
  hint?: string;
  icon: string;
  insert: () => string;
  run?: () => Promise<void>;
}

export function Composer({
  placeholder,
  onSend,
}: {
  placeholder: string;
  onSend: (content: string) => Promise<void>;
}) {
  const { pages, files, members, identity, currentSpaceId, createPage, refreshFiles } =
    useDuochat();
  const [draft, setDraft] = useState("");
  const [selected, setSelected] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const trigger = useMemo(() => detectTrigger(draft, getCursor(textareaRef)), [draft]);

  const suggestions: Suggestion[] = useMemo(() => {
    if (!trigger) return [];
    const q = trigger.query.toLowerCase();
    if (trigger.kind === "ref") {
      const pageSug: Suggestion[] = pages
        .filter((p) => p.title.toLowerCase().includes(q))
        .slice(0, 5)
        .map((p) => ({
          id: `page:${p.id}`,
          label: p.title || "Untitled",
          hint: "page",
          icon: "📄",
          insert: () => formatPageRef(p.id, p.title || "Untitled"),
        }));
      const fileSug: Suggestion[] = files
        .filter((f) => f.name.toLowerCase().includes(q))
        .slice(0, 5)
        .map((f) => ({
          id: `file:${f.id}`,
          label: f.name,
          hint: "file",
          icon: "📎",
          insert: () => formatFileRef(f.id, f.name),
        }));
      return [...pageSug, ...fileSug];
    }
    if (trigger.kind === "mention") {
      const me = identity?.author_id;
      return members
        .filter((m) => {
          if (m.node_id === me) return false;
          const label = m.display_name || m.node_id;
          return label.toLowerCase().includes(q);
        })
        .slice(0, 5)
        .map((m) => ({
          id: m.node_id,
          label: m.display_name || m.node_id.slice(0, 8),
          hint: "partner",
          icon: "🧑",
          insert: () =>
            formatMention(m.node_id, m.display_name || m.node_id.slice(0, 8)),
        }));
    }
    // slash
    const items: Suggestion[] = [
      {
        id: "cmd:page",
        label: "/page <title>",
        hint: "Create a new page",
        icon: "📄",
        insert: () => "",
        run: async () => {
          const title = trigger.query.replace(/^page\s*/, "").trim() || "Untitled";
          const p = await createPage(title);
          insertAtTrigger(
            setDraft,
            draft,
            trigger,
            formatPageRef(p.id, p.title || "Untitled") + " ",
          );
          useDuochat.getState().setSidePanel({ kind: "page", id: p.id });
        },
      },
      {
        id: "cmd:file",
        label: "/file",
        hint: "Upload a file and insert a reference",
        icon: "📎",
        insert: () => "",
        run: async () => {
          if (!currentSpaceId) return;
          const selected = await openDialog({ multiple: false, directory: false });
          if (!selected) return;
          const meta = await cmd.fileUpload(currentSpaceId, selected);
          await refreshFiles();
          insertAtTrigger(
            setDraft,
            draft,
            trigger,
            formatFileRef(meta.id, meta.name) + " ",
          );
        },
      },
    ];
    return items.filter((s) => s.label.toLowerCase().includes(q));
  }, [trigger, pages, files, members, identity, draft, currentSpaceId, createPage, refreshFiles]);

  useEffect(() => {
    setSelected(0);
  }, [trigger?.query, trigger?.kind]);

  function onSelect(i: number) {
    const s = suggestions[i];
    if (!s || !trigger) return;
    if (s.run) {
      void s.run();
      return;
    }
    const insertion = s.insert() + " ";
    insertAtTrigger(setDraft, draft, trigger, insertion);
  }

  async function submit() {
    const content = draft.trim();
    if (!content) return;
    setDraft("");
    await onSend(content);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (trigger && suggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelected((s) => (s + 1) % suggestions.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelected((s) => (s - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        onSelect(selected);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        // best-effort: close by inserting a space to break the trigger
        setDraft(draft + " ");
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="p-3 border-t border-duo-border bg-duo-surface/60"
    >
      <div className="relative">
        {trigger && suggestions.length > 0 && (
          <div className="absolute bottom-full left-0 right-0 mb-2 bg-duo-surface border border-duo-border rounded-lg shadow-lg overflow-hidden">
            <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-duo-muted border-b border-duo-border">
              {trigger.kind === "ref" && "Reference a page or file"}
              {trigger.kind === "mention" && "Mention your partner"}
              {trigger.kind === "slash" && "Slash commands"}
            </div>
            {suggestions.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSelect(i);
                }}
                className={clsx(
                  "w-full flex items-center gap-2 px-3 py-2 text-sm text-left",
                  i === selected ? "bg-duo-accent/20" : "hover:bg-duo-border/40",
                )}
              >
                <span>{s.icon}</span>
                <span className="flex-1 truncate">{s.label}</span>
                {s.hint && (
                  <span className="text-[10px] text-duo-muted">{s.hint}</span>
                )}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2 bg-duo-bg border border-duo-border rounded-xl px-3 py-2">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder={placeholder}
            className="flex-1 resize-none bg-transparent text-sm text-duo-text placeholder:text-duo-muted max-h-40"
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            className="text-duo-accent disabled:text-duo-muted px-2 py-1 text-sm font-medium"
          >
            Send
          </button>
        </div>
      </div>
      <div className="text-[10px] text-duo-muted/70 mt-1 px-1">
        Tip: type <kbd className="px-1 rounded bg-duo-border/60">[[</kbd> to
        link a page or file · <kbd className="px-1 rounded bg-duo-border/60">@</kbd>{" "}
        to mention your partner · <kbd className="px-1 rounded bg-duo-border/60">/</kbd>{" "}
        for slash commands
      </div>
    </form>
  );
}

function getCursor(ref: React.RefObject<HTMLTextAreaElement | null>): number {
  return ref.current?.selectionStart ?? 0;
}

function detectTrigger(text: string, cursor: number): Trigger | null {
  const before = text.slice(0, cursor);

  // /command: entire message starts with / and no newline yet
  if (/^\/[A-Za-z0-9_-]*$/.test(before) || /^\/[A-Za-z0-9_-]+\s[^\n]*$/.test(before)) {
    return { kind: "slash", query: before.slice(1), start: 0 };
  }

  // [[query
  const ref = before.lastIndexOf("[[");
  if (ref !== -1) {
    const slice = before.slice(ref);
    if (!slice.includes("]]") && !/[\n]/.test(slice.slice(2))) {
      return { kind: "ref", query: slice.slice(2), start: ref };
    }
  }

  // @query — must be at start or preceded by whitespace
  const at = before.lastIndexOf("@");
  if (at !== -1) {
    const slice = before.slice(at);
    const precededByWs = at === 0 || /\s/.test(before[at - 1] ?? "");
    if (precededByWs && !/\s/.test(slice.slice(1)) && !slice.startsWith("@[")) {
      return { kind: "mention", query: slice.slice(1), start: at };
    }
  }

  return null;
}

function insertAtTrigger(
  setDraft: (s: string) => void,
  draft: string,
  trigger: Trigger,
  insertion: string,
) {
  const end = trigger.kind === "slash" ? draft.length : triggerEnd(draft, trigger);
  const next = draft.slice(0, trigger.start) + insertion + draft.slice(end);
  setDraft(next);
}

function triggerEnd(_draft: string, trigger: Trigger): number {
  if (trigger.kind === "ref") {
    return trigger.start + 2 + trigger.query.length;
  }
  return trigger.start + 1 + trigger.query.length;
}
