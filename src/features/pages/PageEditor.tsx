import { useEffect, useMemo, useRef, useState } from "react";
import { useDuochat } from "../../lib/store";
import { cmd } from "../../lib/tauri";
import { renderMarkdown } from "../../lib/markdown";

export function PageEditor({ pageId }: { pageId: string }) {
  const { currentSpaceId, refreshPages, setSidePanel } = useDuochat();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const lastSavedRef = useRef<{ title: string; body: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!currentSpaceId) return;
    setLoading(true);
    cmd.pageGet(currentSpaceId, pageId).then((res) => {
      if (cancelled) return;
      if (res) {
        setTitle(res.page.title);
        setBody(res.body);
        lastSavedRef.current = { title: res.page.title, body: res.body };
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [currentSpaceId, pageId]);

  // Debounced auto-save
  useEffect(() => {
    if (loading || !currentSpaceId) return;
    const last = lastSavedRef.current;
    if (last && last.title === title && last.body === body) return;
    const handle = window.setTimeout(async () => {
      setSaving(true);
      try {
        await cmd.pageUpdate(currentSpaceId, pageId, title, body);
        lastSavedRef.current = { title, body };
        await refreshPages();
      } finally {
        setSaving(false);
      }
    }, 500);
    return () => window.clearTimeout(handle);
  }, [title, body, currentSpaceId, pageId, loading, refreshPages]);

  const previewHtml = useMemo(() => renderMarkdown(body), [body]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-duo-muted text-sm">
        Loading…
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-duo-bg">
      <header className="flex items-center gap-2 px-4 py-3 border-b border-duo-border bg-duo-surface/60">
        <span className="text-duo-muted">📄</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Untitled"
          className="flex-1 bg-transparent text-sm font-semibold text-duo-text"
        />
        <span className="text-[10px] text-duo-muted">
          {saving ? "Saving…" : "Saved"}
        </span>
        <button
          onClick={() => setShowPreview((v) => !v)}
          className="text-xs text-duo-muted hover:text-duo-text px-2 py-1 rounded hover:bg-duo-border/40"
        >
          {showPreview ? "Edit" : "Preview"}
        </button>
        <button
          onClick={async () => {
            if (!currentSpaceId) return;
            if (!confirm("Delete this page?")) return;
            await cmd.pageDelete(currentSpaceId, pageId);
            await refreshPages();
            setSidePanel({ kind: "none" });
          }}
          className="text-xs text-duo-danger hover:underline px-2"
        >
          Delete
        </button>
      </header>

      <div className="flex-1 min-h-0 grid md:grid-cols-2 grid-cols-1">
        {!showPreview && (
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write some markdown…"
            className="md:border-r border-duo-border p-4 bg-duo-bg text-sm font-mono text-duo-text resize-none focus:outline-none w-full h-full"
          />
        )}
        <div
          className={
            "p-4 overflow-y-auto prose prose-invert prose-sm max-w-none " +
            (showPreview ? "md:col-span-2" : "")
          }
          dangerouslySetInnerHTML={{ __html: previewHtml }}
        />
      </div>
    </div>
  );
}
