import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { useDuochat } from "../../lib/store";
import { cmd } from "../../lib/tauri";
import type { Message, Reaction } from "../../lib/types";
import { colorFor, formatTime, initialsFor, shortId } from "../../lib/util";

const QUICK_REACTIONS = ["👍", "❤️", "🎉", "😂", "👀", "🔥"];

export function Chat({ onOpenMenu }: { onOpenMenu?: () => void }) {
  const {
    identity,
    currentChannelId,
    currentThreadId,
    channels,
    threads,
    messagesByScope,
    reactions,
    sendMessage,
    toggleReaction,
    selectThread,
  } = useDuochat();

  const [draft, setDraft] = useState("");

  const channel = channels.find((c) => c.id === currentChannelId);
  const thread = threads.find((t) => t.id === currentThreadId);

  const scopeKey = currentThreadId
    ? `t:${currentThreadId}`
    : currentChannelId
      ? `c:${currentChannelId}`
      : null;

  const messages = scopeKey ? messagesByScope[scopeKey] ?? [] : [];

  const reactionsByMessage = useMemo(() => {
    const map: Record<string, Reaction[]> = {};
    for (const r of reactions) {
      (map[r.message_id] ??= []).push(r);
    }
    return map;
  }, [reactions]);

  const scrollerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length, scopeKey]);

  if (!currentChannelId || !channel) {
    return (
      <div className="flex-1 flex items-center justify-center text-duo-muted p-6 text-center">
        Pick a channel to start chatting, or create one in the sidebar.
      </div>
    );
  }

  async function onSend(e: React.FormEvent) {
    e.preventDefault();
    const content = draft;
    setDraft("");
    await sendMessage(content);
  }

  return (
    <div className="flex-1 min-w-0 flex flex-col bg-duo-bg">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-duo-border bg-duo-surface/60">
        {onOpenMenu && (
          <button
            onClick={onOpenMenu}
            className="md:hidden text-duo-muted hover:text-duo-text"
            aria-label="Open channels"
          >
            ☰
          </button>
        )}
        <div className="text-duo-muted">#</div>
        <div className="font-semibold truncate">{channel.name}</div>
        {thread && (
          <div className="flex items-center gap-2 ml-2">
            <span className="text-duo-muted">›</span>
            <span className="text-sm">{thread.name}</span>
            <button
              onClick={() => selectThread(null)}
              className="text-xs text-duo-muted hover:text-duo-text"
            >
              (exit thread)
            </button>
          </div>
        )}
      </header>

      <div ref={scrollerRef} className="flex-1 overflow-y-auto px-2 md:px-6">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-duo-muted text-sm">
            {thread ? "Start the thread…" : "This is the beginning of the channel."}
          </div>
        ) : (
          <div className="py-3 space-y-3">
            {messages.map((m, i) => {
              const isMine = identity?.author_id === m.author;
              const prev = messages[i - 1];
              const collapse =
                prev && prev.author === m.author && m.created_at - prev.created_at < 5 * 60_000;
              return (
                <MessageRow
                  key={m.id}
                  message={m}
                  isMine={isMine}
                  collapse={!!collapse}
                  reactions={reactionsByMessage[m.id] ?? []}
                  onReact={(emoji) => toggleReaction(m.id, emoji)}
                  onCreateThread={async () => {
                    const name = prompt("Thread name", "Thread");
                    if (!name?.trim()) return;
                    const spaceId = useDuochat.getState().currentSpaceId!;
                    const t = await cmd.threadCreate(
                      spaceId,
                      channel.id,
                      m.id,
                      name.trim(),
                    );
                    await useDuochat.getState().refreshMeta();
                    selectThread(t.id);
                  }}
                />
              );
            })}
          </div>
        )}
      </div>

      <form onSubmit={onSend} className="p-3 border-t border-duo-border bg-duo-surface/60">
        <div className="flex items-end gap-2 bg-duo-bg border border-duo-border rounded-xl px-3 py-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void onSend(e as unknown as React.FormEvent);
              }
            }}
            rows={1}
            placeholder={`Message #${channel.name}${thread ? ` › ${thread.name}` : ""}`}
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
      </form>
    </div>
  );
}

function MessageRow({
  message,
  isMine,
  collapse,
  reactions,
  onReact,
  onCreateThread,
}: {
  message: Message;
  isMine: boolean;
  collapse: boolean;
  reactions: Reaction[];
  onReact: (emoji: string) => void;
  onCreateThread: () => void;
}) {
  const [hover, setHover] = useState(false);
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of reactions) c[r.emoji] = (c[r.emoji] ?? 0) + 1;
    return c;
  }, [reactions]);

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={clsx(
        "relative flex gap-3 px-2 py-0.5 rounded",
        hover && "bg-duo-surface/50",
      )}
    >
      {!collapse ? (
        <div
          className="h-9 w-9 rounded-full flex items-center justify-center text-xs font-semibold text-white shrink-0"
          style={{ backgroundColor: colorFor(message.author) }}
        >
          {initialsFor(message.author)}
        </div>
      ) : (
        <div className="w-9 shrink-0 text-[10px] text-duo-muted/70 text-right pt-1 pr-1 opacity-0 group-hover:opacity-100">
          {new Date(message.created_at).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      )}

      <div className="min-w-0 flex-1">
        {!collapse && (
          <div className="flex items-baseline gap-2">
            <span
              className="font-semibold text-sm"
              style={{ color: colorFor(message.author) }}
            >
              {isMine ? "you" : shortId(message.author, 4)}
            </span>
            <span className="text-[11px] text-duo-muted">
              {formatTime(message.created_at)}
            </span>
          </div>
        )}
        <div className="text-sm whitespace-pre-wrap break-words">
          {message.content}
        </div>
        {Object.keys(counts).length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {Object.entries(counts).map(([emoji, n]) => (
              <button
                key={emoji}
                onClick={() => onReact(emoji)}
                className="px-2 py-0.5 text-xs rounded-full bg-duo-surface border border-duo-border hover:border-duo-accent"
              >
                {emoji} {n}
              </button>
            ))}
          </div>
        )}
      </div>

      {hover && (
        <div className="absolute -top-4 right-2 flex items-center gap-1 bg-duo-surface border border-duo-border rounded-full shadow px-2 py-1">
          {QUICK_REACTIONS.map((e) => (
            <button
              key={e}
              onClick={() => onReact(e)}
              className="hover:scale-110 transition"
            >
              {e}
            </button>
          ))}
          <div className="w-px h-4 bg-duo-border mx-1" />
          <button
            onClick={onCreateThread}
            className="text-xs text-duo-muted hover:text-duo-text"
            title="Start a thread"
          >
            🧵
          </button>
        </div>
      )}
    </div>
  );
}
