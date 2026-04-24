import { useState } from "react";
import clsx from "clsx";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { useDuochat } from "../../lib/store";
import { cmd } from "../../lib/tauri";

export function FilesPanel({ onPick }: { onPick?: () => void }) {
  const { files, sidePanel, setSidePanel, currentSpaceId, refreshFiles } =
    useDuochat();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onUpload() {
    if (!currentSpaceId) return;
    setError(null);
    try {
      const selected = await openDialog({ multiple: false, directory: false });
      if (!selected) return;
      setBusy(true);
      await cmd.fileUpload(currentSpaceId, selected);
      await refreshFiles();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex-1 min-w-0 flex flex-col">
      <div className="px-4 py-3 border-b border-duo-border flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-semibold">Files</div>
          <div className="text-[11px] text-duo-muted">
            Stored peer-to-peer in iroh-blobs.
          </div>
        </div>
        <button
          onClick={onUpload}
          disabled={busy}
          className="px-2 py-1 text-xs bg-duo-accent hover:bg-duo-accenthover disabled:opacity-50 text-white rounded"
        >
          {busy ? "Uploading…" : "Upload"}
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {error && (
          <div className="text-xs text-duo-danger px-2 py-1">{error}</div>
        )}
        {files.length === 0 && (
          <div className="text-xs text-duo-muted px-2 py-3">
            No files yet. Upload one to share with your partner.
          </div>
        )}
        <div className="space-y-0.5">
          {files.map((f) => {
            const active =
              sidePanel.kind === "file" && sidePanel.id === f.id;
            return (
              <button
                key={f.id}
                onClick={() => {
                  setSidePanel({ kind: "file", id: f.id });
                  onPick?.();
                }}
                className={clsx(
                  "w-full text-left px-2 py-2 rounded text-sm",
                  active
                    ? "bg-duo-border/60 text-duo-text"
                    : "text-duo-muted hover:bg-duo-border/30 hover:text-duo-text",
                )}
                title={f.name}
              >
                <div className="flex items-center gap-2 truncate">
                  <span className="opacity-70">{iconForMime(f.mime)}</span>
                  <span className="truncate">{f.name}</span>
                </div>
                <div className="text-[10px] text-duo-muted/70 mt-0.5 truncate">
                  {humanSize(f.size)} · {f.mime}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function iconForMime(mime: string): string {
  if (mime.startsWith("image/")) return "🖼";
  if (mime.startsWith("video/")) return "🎞";
  if (mime.startsWith("audio/")) return "🎵";
  if (mime === "application/pdf") return "📕";
  if (mime.startsWith("text/")) return "📝";
  return "📎";
}
