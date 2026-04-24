import clsx from "clsx";
import { useDuochat } from "../../lib/store";
import { ChannelsPanel } from "./ChannelsPanel";
import { PagesPanel } from "../pages/PagesPanel";
import { FilesPanel } from "../files/FilesPanel";

export function Sidebar({ onPickChannel }: { onPickChannel?: () => void }) {
  const { spaces, currentSpaceId, sidebarTab, setSidebarTab, openSpace } =
    useDuochat();

  return (
    <div className="h-full flex flex-row bg-duo-sidebar text-duo-text">
      <div className="w-14 bg-duo-rail border-r border-duo-border flex flex-col items-center py-3 gap-2 shrink-0">
        {spaces.map((s) => (
          <button
            key={s.id}
            onClick={() => openSpace(s.id)}
            title={s.id}
            className={clsx(
              "h-10 w-10 rounded-xl flex items-center justify-center font-semibold text-sm transition",
              currentSpaceId === s.id
                ? "bg-duo-accent text-white rounded-[14px]"
                : "bg-duo-surface hover:bg-duo-accent hover:text-white hover:rounded-[14px] text-duo-muted",
            )}
          >
            {s.id.slice(0, 2).toUpperCase()}
          </button>
        ))}
      </div>

      <div className="flex-1 min-w-0 flex flex-col">
        <div className="px-4 py-3 border-b border-duo-border shadow-sm">
          <div className="text-sm font-semibold truncate">duochat space</div>
          {currentSpaceId && (
            <div className="text-[10px] text-duo-muted font-mono truncate">
              {currentSpaceId.slice(0, 20)}…
            </div>
          )}
        </div>

        <div className="flex items-stretch border-b border-duo-border bg-duo-surface/40">
          <TabButton
            active={sidebarTab === "chat"}
            onClick={() => setSidebarTab("chat")}
            label="Chat"
            icon="#"
          />
          <TabButton
            active={sidebarTab === "pages"}
            onClick={() => setSidebarTab("pages")}
            label="Pages"
            icon="📄"
          />
          <TabButton
            active={sidebarTab === "files"}
            onClick={() => setSidebarTab("files")}
            label="Files"
            icon="📎"
          />
        </div>

        {sidebarTab === "chat" && (
          <ChannelsPanel onPickChannel={onPickChannel} />
        )}
        {sidebarTab === "pages" && <PagesPanel onPick={onPickChannel} />}
        {sidebarTab === "files" && <FilesPanel onPick={onPickChannel} />}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: string;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "flex-1 text-xs py-2 flex items-center justify-center gap-1 border-b-2 transition",
        active
          ? "border-duo-accent text-duo-text"
          : "border-transparent text-duo-muted hover:text-duo-text",
      )}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  );
}
