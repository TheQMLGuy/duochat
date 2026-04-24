import { listen } from "@tauri-apps/api/event";
import type { SpaceEvent } from "./types";
import { useDuochat } from "./store";

export async function installEventListeners() {
  const store = useDuochat.getState;

  const unNode = await listen<void>("node:ready", () => {
    void store().loadIdentity();
    void store().refreshSpaces();
  });

  const unErr = await listen<string>("node:error", (e) => {
    console.error("node error:", e.payload);
  });

  const unSpace = await listen<SpaceEvent>("space:event", (e) => {
    const payload = e.payload;
    const s = store();
    if (payload.space_id !== s.currentSpaceId) return;
    switch (payload.kind) {
      case "insert_local":
      case "insert_remote":
        void s.applyInsertedKey(payload.key);
        break;
      case "neighbor_up":
        s.markNeighbor(payload.node_id, true);
        break;
      case "neighbor_down":
        s.markNeighbor(payload.node_id, false);
        break;
      case "sync_finished":
      case "pending_content_ready":
      case "content_ready":
        // Opportunistically refresh current view in case content just landed
        if (s.currentChannelId) {
          void s.loadMessages(s.currentChannelId, s.currentThreadId);
        }
        break;
    }
  });

  return () => {
    unNode();
    unErr();
    unSpace();
  };
}
