import { useState } from "react";
import clsx from "clsx";
import { useDuochat } from "../../lib/store";

export function PagesPanel({ onPick }: { onPick?: () => void }) {
  const { pages, sidePanel, setSidePanel, createPage } = useDuochat();
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);

  async function onCreate() {
    if (!newTitle.trim()) return;
    const p = await createPage(newTitle.trim());
    setNewTitle("");
    setCreating(false);
    setSidePanel({ kind: "page", id: p.id });
    onPick?.();
  }

  return (
    <div className="flex-1 min-w-0 flex flex-col">
      <div className="px-4 py-3 border-b border-duo-border">
        <div className="text-sm font-semibold">Pages</div>
        <div className="text-[11px] text-duo-muted">
          Markdown notes shared with your partner.
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {pages.length === 0 && !creating && (
          <div className="text-xs text-duo-muted px-2 py-3">
            No pages yet. Create one to get started.
          </div>
        )}
        <div className="space-y-0.5">
          {pages.map((p) => {
            const active =
              sidePanel.kind === "page" && sidePanel.id === p.id;
            return (
              <button
                key={p.id}
                onClick={() => {
                  setSidePanel({ kind: "page", id: p.id });
                  onPick?.();
                }}
                className={clsx(
                  "w-full text-left px-2 py-1.5 rounded text-sm flex items-center gap-2 truncate",
                  active
                    ? "bg-duo-border/60 text-duo-text"
                    : "text-duo-muted hover:bg-duo-border/30 hover:text-duo-text",
                )}
                title={p.title}
              >
                <span className="opacity-70">📄</span>
                <span className="truncate">{p.title || "Untitled"}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-3 px-2">
          {!creating ? (
            <button
              onClick={() => setCreating(true)}
              className="text-xs text-duo-muted hover:text-duo-text"
            >
              + New page
            </button>
          ) : (
            <div className="flex gap-2">
              <input
                autoFocus
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void onCreate();
                  if (e.key === "Escape") {
                    setCreating(false);
                    setNewTitle("");
                  }
                }}
                placeholder="Page title"
                className="flex-1 bg-duo-bg border border-duo-border rounded px-2 py-1 text-xs"
              />
              <button
                onClick={onCreate}
                className="px-2 py-1 text-xs bg-duo-accent rounded text-white"
              >
                Add
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
