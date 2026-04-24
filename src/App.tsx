import { useEffect, useState } from "react";
import "./App.css";
import { useDuochat } from "./lib/store";
import { installEventListeners } from "./lib/events";
import { Pairing } from "./features/pairing/Pairing";
import { Sidebar } from "./features/sidebar/Sidebar";
import { Chat } from "./features/chat/Chat";
import { ThreadsPanel } from "./features/threads/ThreadsPanel";
import { PageEditor } from "./features/pages/PageEditor";
import { FileViewer } from "./features/files/FileViewer";

function App() {
  const {
    ready,
    loadIdentity,
    refreshSpaces,
    spaces,
    currentSpaceId,
    sidePanel,
    setSidePanel,
  } = useDuochat();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let dispose: (() => void) | undefined;
    (async () => {
      dispose = await installEventListeners();
      setBooting(false);
      for (let i = 0; i < 60 && !cancelled; i++) {
        try {
          await loadIdentity();
          await refreshSpaces();
          return;
        } catch {
          await new Promise((r) => setTimeout(r, 500));
        }
      }
    })();
    return () => {
      cancelled = true;
      dispose?.();
    };
  }, [loadIdentity, refreshSpaces]);

  if (booting || !ready) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <div className="text-sm text-duo-muted">Starting your node…</div>
      </div>
    );
  }

  if (spaces.length === 0 || !currentSpaceId) {
    return <Pairing />;
  }

  const panelBody = <SidePanelContent />;
  const panelOpenMobile = sidePanel.kind !== "none";

  return (
    <div className="h-full w-full flex">
      <div className="hidden md:flex md:w-72 lg:w-80 shrink-0 border-r border-duo-border">
        <Sidebar />
      </div>

      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-30 flex">
          <div className="w-72 max-w-[80%] bg-duo-sidebar h-full">
            <Sidebar onPickChannel={() => setDrawerOpen(false)} />
          </div>
          <div
            className="flex-1 bg-black/40"
            onClick={() => setDrawerOpen(false)}
          />
        </div>
      )}

      <Chat onOpenMenu={() => setDrawerOpen(true)} />

      <aside className="hidden md:flex md:w-80 shrink-0 border-l border-duo-border bg-duo-surface/40">
        {panelBody}
      </aside>

      {panelOpenMobile && (
        <div className="md:hidden fixed inset-0 z-40 flex flex-col bg-duo-bg">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-duo-border bg-duo-surface/60">
            <button
              onClick={() => setSidePanel({ kind: "none" })}
              className="text-sm text-duo-muted hover:text-duo-text px-2 py-1"
              aria-label="Back to chat"
            >
              ← Back
            </button>
          </div>
          <div className="flex-1 min-h-0">{panelBody}</div>
        </div>
      )}
    </div>
  );
}

function SidePanelContent() {
  const { sidePanel } = useDuochat();
  if (sidePanel.kind === "page") return <PageEditor pageId={sidePanel.id} />;
  if (sidePanel.kind === "file") return <FileViewer fileId={sidePanel.id} />;
  if (sidePanel.kind === "threads") return <ThreadsPanel />;
  return (
    <div className="h-full w-full flex items-center justify-center text-duo-muted text-xs p-6 text-center">
      Select a page, file, or thread to see it here.
    </div>
  );
}

export default App;
