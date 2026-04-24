import { create } from "zustand";
import type {
  Category,
  Channel,
  FileMeta,
  Identity,
  Member,
  Message,
  Page,
  Reaction,
  SpaceInfo,
  Thread,
} from "./types";
import { cmd } from "./tauri";

export type SidePanel =
  | { kind: "none" }
  | { kind: "page"; id: string }
  | { kind: "file"; id: string }
  | { kind: "threads" };

interface DuochatState {
  ready: boolean;
  identity: Identity | null;

  spaces: SpaceInfo[];
  currentSpaceId: string | null;

  categories: Category[];
  channels: Channel[];
  threads: Thread[];
  members: Member[];
  pages: Page[];
  files: FileMeta[];

  currentChannelId: string | null;
  currentThreadId: string | null;

  messagesByScope: Record<string, Message[]>;
  reactions: Reaction[];

  pendingOnlinePeers: Set<string>;
  sidePanel: SidePanel;
  setSidePanel: (p: SidePanel) => void;
  sidebarTab: "chat" | "pages" | "files";
  setSidebarTab: (t: "chat" | "pages" | "files") => void;

  loadIdentity: () => Promise<void>;
  refreshSpaces: () => Promise<void>;
  createSpace: () => Promise<{ space_id: string; ticket: string }>;
  joinSpace: (ticket: string) => Promise<string>;
  openSpace: (spaceId: string) => Promise<void>;
  getShareTicket: (spaceId: string) => Promise<string>;

  refreshMeta: () => Promise<void>;
  createCategory: (name: string) => Promise<void>;
  createChannel: (name: string, categoryId: string | null) => Promise<Channel>;
  selectChannel: (channelId: string | null) => void;
  selectThread: (threadId: string | null) => void;

  loadMessages: (channelId: string, threadId: string | null) => Promise<void>;
  sendMessage: (content: string) => Promise<void>;

  toggleReaction: (messageId: string, emoji: string) => Promise<void>;
  refreshReactions: () => Promise<void>;

  applyInsertedKey: (key: string) => Promise<void>;

  refreshPages: () => Promise<void>;
  refreshFiles: () => Promise<void>;
  createPage: (title: string, parentId?: string | null) => Promise<Page>;

  markNeighbor: (id: string, online: boolean) => void;
}

function scopeKey(channelId: string, threadId: string | null) {
  return threadId ? `t:${threadId}` : `c:${channelId}`;
}

export const useDuochat = create<DuochatState>((set, get) => ({
  ready: false,
  identity: null,
  spaces: [],
  currentSpaceId: null,
  categories: [],
  channels: [],
  threads: [],
  members: [],
  pages: [],
  files: [],
  currentChannelId: null,
  currentThreadId: null,
  messagesByScope: {},
  reactions: [],
  pendingOnlinePeers: new Set(),
  sidePanel: { kind: "threads" },
  setSidePanel: (p) => set({ sidePanel: p }),
  sidebarTab: "chat",
  setSidebarTab: (t) => set({ sidebarTab: t }),

  async loadIdentity() {
    const identity = await cmd.identityGet();
    set({ identity, ready: true });
  },

  async refreshSpaces() {
    const spaces = await cmd.spaceList();
    set({ spaces });
  },

  async createSpace() {
    const res = await cmd.spaceCreate();
    await get().refreshSpaces();
    await get().openSpace(res.space_id);
    return res;
  },

  async joinSpace(ticket) {
    const spaceId = await cmd.spaceJoin(ticket);
    await get().refreshSpaces();
    await get().openSpace(spaceId);
    return spaceId;
  },

  async openSpace(spaceId) {
    await cmd.spaceOpen(spaceId);
    set({
      currentSpaceId: spaceId,
      currentChannelId: null,
      currentThreadId: null,
      messagesByScope: {},
      pages: [],
      files: [],
    });
    await get().refreshMeta();
    await get().refreshReactions();
    await get().refreshPages();
    await get().refreshFiles();
  },

  async getShareTicket(spaceId) {
    return cmd.spaceShareTicket(spaceId);
  },

  async refreshMeta() {
    const id = get().currentSpaceId;
    if (!id) return;
    const [categories, channels, threads, members] = await Promise.all([
      cmd.categoryList(id),
      cmd.channelList(id),
      cmd.threadList(id),
      cmd.memberList(id),
    ]);
    categories.sort((a, b) => a.position - b.position);
    channels.sort((a, b) => a.position - b.position);
    set({ categories, channels, threads, members });

    // Auto-select a channel if none is selected
    if (!get().currentChannelId && channels.length > 0) {
      get().selectChannel(channels[0].id);
    }
  },

  async createCategory(name) {
    const id = get().currentSpaceId;
    if (!id) return;
    await cmd.categoryCreate(id, name);
    await get().refreshMeta();
  },

  async createChannel(name, categoryId) {
    const id = get().currentSpaceId;
    if (!id) throw new Error("no space open");
    const ch = await cmd.channelCreate(id, name, categoryId);
    await get().refreshMeta();
    return ch;
  },

  selectChannel(channelId) {
    set({ currentChannelId: channelId, currentThreadId: null });
    if (channelId) {
      void get().loadMessages(channelId, null);
    }
  },

  selectThread(threadId) {
    const ch = get().currentChannelId;
    set({ currentThreadId: threadId });
    if (ch && threadId) {
      void get().loadMessages(ch, threadId);
    }
  },

  async loadMessages(channelId, threadId) {
    const id = get().currentSpaceId;
    if (!id) return;
    const msgs = await cmd.messageList(id, channelId, threadId, 200);
    const key = scopeKey(channelId, threadId);
    set((s) => ({
      messagesByScope: { ...s.messagesByScope, [key]: msgs },
    }));
  },

  async sendMessage(content) {
    const { currentSpaceId, currentChannelId, currentThreadId } = get();
    if (!currentSpaceId || !currentChannelId || !content.trim()) return;
    await cmd.messageSend(
      currentSpaceId,
      currentChannelId,
      content,
      currentThreadId,
    );
  },

  async toggleReaction(messageId, emoji) {
    const id = get().currentSpaceId;
    if (!id) return;
    await cmd.reactionToggle(id, messageId, emoji);
    await get().refreshReactions();
  },

  async refreshReactions() {
    const id = get().currentSpaceId;
    if (!id) return;
    const reactions = await cmd.reactionList(id);
    set({ reactions });
  },

  async refreshPages() {
    const id = get().currentSpaceId;
    if (!id) return;
    const pages = await cmd.pageList(id);
    pages.sort((a, b) => a.title.localeCompare(b.title));
    set({ pages });
  },

  async refreshFiles() {
    const id = get().currentSpaceId;
    if (!id) return;
    const files = await cmd.fileList(id);
    files.sort((a, b) => b.uploaded_at - a.uploaded_at);
    set({ files });
  },

  async createPage(title, parentId = null) {
    const id = get().currentSpaceId;
    if (!id) throw new Error("no space open");
    const p = await cmd.pageCreate(id, title, parentId);
    await get().refreshPages();
    return p;
  },

  async applyInsertedKey(key) {
    if (key.startsWith("meta/page/") || key.startsWith("page_body/")) {
      await get().refreshPages();
      return;
    }
    if (key.startsWith("meta/file/") || key.startsWith("blob/")) {
      await get().refreshFiles();
      return;
    }
    if (key.startsWith("meta/")) {
      await get().refreshMeta();
      return;
    }
    if (key.startsWith("msg/")) {
      const parts = key.split("/");
      // msg/{scope}/{ts}/{author_short}/{nonce}
      const scope = parts[1];
      const { currentChannelId, currentThreadId, channels, threads } = get();
      const isCurrent =
        (currentThreadId && scope === currentThreadId) ||
        (!currentThreadId && scope === currentChannelId);
      if (isCurrent && currentChannelId) {
        await get().loadMessages(currentChannelId, currentThreadId);
      } else {
        // Also refresh for visible (sidebar) channels if scope matches a known channel/thread
        const known =
          channels.some((c) => c.id === scope) ||
          threads.some((t) => t.id === scope);
        if (known) {
          // lazily update on switch
        }
      }
      return;
    }
    if (key.startsWith("reaction/")) {
      await get().refreshReactions();
    }
  },

  markNeighbor(id, online) {
    set((s) => {
      const next = new Set(s.pendingOnlinePeers);
      if (online) next.add(id);
      else next.delete(id);
      return { pendingOnlinePeers: next };
    });
  },
}));
