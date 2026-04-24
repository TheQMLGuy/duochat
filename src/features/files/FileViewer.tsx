import { useMemo, useState } from "react";
import { useDuochat } from "../../lib/store";
import { cmd } from "../../lib/tauri";

export function FileViewer({ fileId }: { fileId: string }) {
  const { files, currentSpaceId, setSidePanel } = useDuochat();
  const file = useMemo(() => files.find((f) => f.id === fileId), [files, fileId]);
  const [downloading, setDownloading] = useState(false);
  const [savedTo, setSavedTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!file) {
    return (
      <div className="h-full flex items-center justify-center text-duo-muted text-sm">
        File not found (it may still be syncing).
      </div>
    );
  }

  async function onDownload() {
    if (!currentSpaceId || !file) return;
    setError(null);
    setDownloading(true);
    try {
      const target = await cmd.fileDefaultDownloadPath(file.name);
      await cmd.fileExport(currentSpaceId, file.id, target);
      setSavedTo(target);
    } catch (e) {
      setError(String(e));
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="h-full flex flex-col bg-duo-bg">
      <header className="flex items-center gap-2 px-4 py-3 border-b border-duo-border bg-duo-surface/60">
        <span className="text-duo-muted">📎</span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold truncate">{file.name}</div>
          <div className="text-[11px] text-duo-muted truncate">
            {humanSize(file.size)} · {file.mime}
          </div>
        </div>
        <button
          onClick={() => setSidePanel({ kind: "none" })}
          className="text-xs text-duo-muted hover:text-duo-text px-2"
        >
          Close
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        <div className="text-duo-muted text-sm">
          Stored peer-to-peer in iroh-blobs. The content lives on both devices
          after sync.
        </div>
        <div className="font-mono text-[10px] text-duo-muted/80 break-all">
          hash: {file.hash}
        </div>

        <button
          onClick={onDownload}
          disabled={downloading}
          className="px-3 py-2 rounded-lg bg-duo-accent hover:bg-duo-accenthover disabled:opacity-50 text-white text-sm"
        >
          {downloading ? "Exporting…" : "Save to Downloads"}
        </button>
        {savedTo && (
          <div className="text-xs text-duo-muted break-all">
            Saved to <span className="font-mono">{savedTo}</span>
          </div>
        )}
        {error && <div className="text-xs text-duo-danger">{error}</div>}
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
