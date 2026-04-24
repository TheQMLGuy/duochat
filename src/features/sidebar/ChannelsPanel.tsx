import { useMemo, useState } from "react";
import clsx from "clsx";
import { useDuochat } from "../../lib/store";
import type { Channel } from "../../lib/types";

export function ChannelsPanel({
  onPickChannel,
}: {
  onPickChannel?: () => void;
}) {
  const {
    categories,
    channels,
    currentChannelId,
    selectChannel,
    createCategory,
    createChannel,
    setSidePanel,
  } = useDuochat();

  const [newChannel, setNewChannel] = useState<{
    open: boolean;
    categoryId: string | null;
  }>({ open: false, categoryId: null });
  const [channelName, setChannelName] = useState("");
  const [newCategoryOpen, setNewCategoryOpen] = useState(false);
  const [categoryName, setCategoryName] = useState("");

  const grouped = useMemo(() => {
    const byCat: Record<string, Channel[]> = { __none__: [] };
    for (const c of categories) byCat[c.id] = [];
    for (const ch of channels) {
      const key = ch.category_id ?? "__none__";
      if (!byCat[key]) byCat[key] = [];
      byCat[key].push(ch);
    }
    return byCat;
  }, [categories, channels]);

  async function onCreateChannel() {
    if (!channelName.trim()) return;
    const c = await createChannel(channelName.trim(), newChannel.categoryId);
    setChannelName("");
    setNewChannel({ open: false, categoryId: null });
    selectChannel(c.id);
    setSidePanel({ kind: "threads" });
    onPickChannel?.();
  }

  async function onCreateCategory() {
    if (!categoryName.trim()) return;
    await createCategory(categoryName.trim());
    setCategoryName("");
    setNewCategoryOpen(false);
  }

  return (
    <div className="flex-1 min-w-0 flex flex-col">
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        <CategoryBlock
          label="No category"
          channels={grouped["__none__"] ?? []}
          currentChannelId={currentChannelId}
          onPick={(id) => {
            selectChannel(id);
            setSidePanel({ kind: "threads" });
            onPickChannel?.();
          }}
          onNewChannel={() => setNewChannel({ open: true, categoryId: null })}
        />

        {categories.map((cat) => (
          <CategoryBlock
            key={cat.id}
            label={cat.name}
            channels={grouped[cat.id] ?? []}
            currentChannelId={currentChannelId}
            onPick={(id) => {
              selectChannel(id);
              setSidePanel({ kind: "threads" });
              onPickChannel?.();
            }}
            onNewChannel={() =>
              setNewChannel({ open: true, categoryId: cat.id })
            }
          />
        ))}

        <div className="px-2">
          {!newCategoryOpen ? (
            <button
              onClick={() => setNewCategoryOpen(true)}
              className="text-xs text-duo-muted hover:text-duo-text"
            >
              + New category
            </button>
          ) : (
            <div className="flex gap-2">
              <input
                autoFocus
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void onCreateCategory();
                  if (e.key === "Escape") {
                    setNewCategoryOpen(false);
                    setCategoryName("");
                  }
                }}
                placeholder="Category name"
                className="flex-1 bg-duo-bg border border-duo-border rounded px-2 py-1 text-xs"
              />
              <button
                onClick={onCreateCategory}
                className="px-2 py-1 text-xs bg-duo-accent rounded text-white"
              >
                Add
              </button>
            </div>
          )}
        </div>

        {newChannel.open && (
          <div className="px-2">
            <div className="text-[10px] uppercase tracking-wide text-duo-muted mb-1">
              New channel
              {newChannel.categoryId
                ? ` in ${categories.find((c) => c.id === newChannel.categoryId)?.name ?? ""}`
                : ""}
            </div>
            <div className="flex gap-2">
              <input
                autoFocus
                value={channelName}
                onChange={(e) => setChannelName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void onCreateChannel();
                  if (e.key === "Escape") {
                    setNewChannel({ open: false, categoryId: null });
                    setChannelName("");
                  }
                }}
                placeholder="channel-name"
                className="flex-1 bg-duo-bg border border-duo-border rounded px-2 py-1 text-xs"
              />
              <button
                onClick={onCreateChannel}
                className="px-2 py-1 text-xs bg-duo-accent rounded text-white"
              >
                Add
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CategoryBlock({
  label,
  channels,
  currentChannelId,
  onPick,
  onNewChannel,
}: {
  label: string;
  channels: Channel[];
  currentChannelId: string | null;
  onPick: (id: string) => void;
  onNewChannel: () => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between px-2 mb-1 group">
        <div className="text-[10px] uppercase tracking-wider text-duo-muted font-semibold">
          {label}
        </div>
        <button
          onClick={onNewChannel}
          className="text-duo-muted hover:text-duo-text opacity-0 group-hover:opacity-100 text-sm leading-none"
          title="New channel"
        >
          +
        </button>
      </div>
      <div className="space-y-0.5">
        {channels.map((ch) => (
          <button
            key={ch.id}
            onClick={() => onPick(ch.id)}
            className={clsx(
              "w-full text-left px-2 py-1 rounded text-sm truncate flex items-center gap-1",
              currentChannelId === ch.id
                ? "bg-duo-border/60 text-duo-text"
                : "text-duo-muted hover:bg-duo-border/30 hover:text-duo-text",
            )}
          >
            <span className="opacity-60">#</span>
            <span className="truncate">{ch.name}</span>
          </button>
        ))}
        {channels.length === 0 && (
          <div className="px-2 text-[11px] text-duo-muted/60">— no channels</div>
        )}
      </div>
    </div>
  );
}
