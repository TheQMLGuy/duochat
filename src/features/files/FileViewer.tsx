import { useEffect, useMemo, useState } from "react";
import { useDuochat } from "../../lib/store";
import { cmd } from "../../lib/tauri";

const PREVIEW_LIMIT = 8 * 1024 * 1024; // 8 MB

export function FileViewer({ fileId }: { fileId: string }) {
  const { files, currentSpaceId, setSidePanel } = useDuochat();
  const file = useMemo(() => files.find((f) => f.id === fileId), [files, fileId]);
  const [downloading, setDownloading] = useState(false);
  const [savedTo, setSavedTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewText, setPreviewText] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const previewable = useMemo(() => {
    if (!file) return { kind: "none" as const };
    if (file.size > PREVIEW_LIMIT) return { kind: "too_large" as const };
    if (file.mime.startsWith("image/")) return { kind: "image" as const };
    if (file.mime.startsWith("text/") || file.mime === "application/json")
      return { kind: "text" as const };
    return { kind: "none" as const };
  }, [file]);

  useEffect(() => {
    let revoked: string | null = null;
    setPreviewUrl(null);
    setPreviewText(null);
    setError(null);
    if (!file || !currentSpaceId) return;
    if (previewable.kind === "none" || previewable.kind === "too_large") return;

    let cancelled = false;
    setLoadingPreview(true);
    cmd
      .fileReadPreview(currentSpaceId, file.id, PREVIEW_LIMIT)
      .then((res) => {
        if (cancelled) return;
        const bytes = new Uint8Array(res.bytes);
        if (previewable.kind === "image") {
          const blob = new Blob([bytes], { type: file.mime });
          const url = URL.createObjectURL(blob);
          revoked = url;
          setPreviewUrl(url);
        } else {
          const text = new TextDecoder().decode(bytes);
          setPreviewText(text);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      })
      .finally(() => {
        if (!cancelled) setLoadingPreview(false);
      });

    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [file, currentSpaceId, previewable.kind]);

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

      <div className="flex-1 overflow-y-auto">
        {previewable.kind === "image" && (
          <div className="bg-duo-bg p-2 flex items-center justify-center min-h-40">
            {loadingPreview && (
              <div className="text-xs text-duo-muted">Loading preview…</div>
            )}
            {previewUrl && (
              <img
                src={previewUrl}
                alt={file.name}
                className="max-w-full max-h-[60vh] object-contain rounded"
              />
            )}
          </div>
        )}

        {previewable.kind === "text" && (
          <div className="p-3">
            {loadingPreview && (
              <div className="text-xs text-duo-muted">Loading preview…</div>
            )}
            {previewText !== null && (
              <pre className="text-xs font-mono bg-duo-surface p-3 rounded border border-duo-border whitespace-pre-wrap break-words max-h-[60vh] overflow-y-auto">
                {previewText}
              </pre>
            )}
          </div>
        )}

        {previewable.kind === "too_large" && (
          <div className="p-3 text-xs text-duo-muted">
            Preview disabled for files larger than {humanSize(PREVIEW_LIMIT)}.
            Use Save to Downloads instead.
          </div>
        )}

        <div className="p-6 space-y-3 border-t border-duo-border">
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
          <div className="font-mono text-[10px] text-duo-muted/80 break-all">
            hash: {file.hash}
          </div>
        </div>
      </div>
    </div>
  );
}

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
