import { useMemo } from "react";
import clsx from "clsx";
import { useDuochat } from "../../lib/store";

export function ThreadsPanel() {
  const { channels, threads, currentChannelId, currentThreadId, selectThread } =
    useDuochat();
  const channel = channels.find((c) => c.id === currentChannelId);

  const channelThreads = useMemo(
    () => threads.filter((t) => t.channel_id === currentChannelId),
    [threads, currentChannelId],
  );

  return (
    <div className="flex-1 min-w-0 flex flex-col">
      <div className="px-4 py-3 border-b border-duo-border">
        <div className="text-xs uppercase tracking-wider text-duo-muted">
          Threads
        </div>
        <div className="text-sm font-semibold truncate">
          {channel?.name ?? "—"}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {channelThreads.length === 0 && (
          <div className="text-xs text-duo-muted px-2 py-4">
            No threads yet. Hover a message and click 🧵 to start one.
          </div>
        )}
        {channelThreads.map((t) => (
          <button
            key={t.id}
            onClick={() => selectThread(t.id)}
            className={clsx(
              "w-full text-left px-2 py-2 rounded text-sm",
              currentThreadId === t.id
                ? "bg-duo-border/60 text-duo-text"
                : "text-duo-muted hover:bg-duo-border/30 hover:text-duo-text",
            )}
          >
            <div className="truncate">🧵 {t.name}</div>
            <div className="text-[10px] text-duo-muted/60 mt-0.5">
              {new Date(t.created_at).toLocaleString()}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
