import { invoke } from "@tauri-apps/api/core";
import type {
  Category,
  Channel,
  CreatedSpace,
  FileMeta,
  Identity,
  Member,
  Message,
  Page,
  PageWithBody,
  Reaction,
  SpaceInfo,
  Thread,
} from "./types";

export const cmd = {
  identityGet: () => invoke<Identity>("identity_get"),

  spaceCreate: () => invoke<CreatedSpace>("space_create"),
  spaceJoin: (ticket: string) => invoke<string>("space_join", { ticket }),
  spaceList: () => invoke<SpaceInfo[]>("space_list"),
  spaceOpen: (spaceId: string) => invoke<string>("space_open", { spaceId }),
  spaceShareTicket: (spaceId: string) =>
    invoke<string>("space_share_ticket", { spaceId }),

  categoryList: (spaceId: string) =>
    invoke<Category[]>("category_list", { spaceId }),
  categoryCreate: (spaceId: string, name: string) =>
    invoke<Category>("category_create", { spaceId, name }),
  categoryDelete: (spaceId: string, id: string) =>
    invoke<void>("category_delete", { spaceId, id }),

  channelList: (spaceId: string) =>
    invoke<Channel[]>("channel_list", { spaceId }),
  channelCreate: (
    spaceId: string,
    name: string,
    categoryId: string | null,
  ) =>
    invoke<Channel>("channel_create", {
      spaceId,
      name,
      categoryId,
    }),
  channelRename: (spaceId: string, id: string, newName: string) =>
    invoke<void>("channel_rename", { spaceId, id, newName }),
  channelDelete: (spaceId: string, id: string) =>
    invoke<void>("channel_delete", { spaceId, id }),

  threadList: (spaceId: string) => invoke<Thread[]>("thread_list", { spaceId }),
  threadCreate: (
    spaceId: string,
    channelId: string,
    parentMessageId: string,
    name: string,
  ) =>
    invoke<Thread>("thread_create", {
      spaceId,
      channelId,
      parentMessageId,
      name,
    }),

  messageList: (
    spaceId: string,
    channelId: string,
    threadId: string | null = null,
    limit = 200,
  ) =>
    invoke<Message[]>("message_list", {
      spaceId,
      channelId,
      threadId,
      limit,
    }),
  messageSend: (
    spaceId: string,
    channelId: string,
    content: string,
    threadId: string | null = null,
  ) =>
    invoke<Message>("message_send", {
      spaceId,
      channelId,
      threadId,
      content,
    }),

  reactionToggle: (spaceId: string, messageId: string, emoji: string) =>
    invoke<boolean>("reaction_toggle", { spaceId, messageId, emoji }),
  reactionList: (spaceId: string) =>
    invoke<Reaction[]>("reaction_list", { spaceId }),

  memberUpsert: (spaceId: string, displayName: string) =>
    invoke<Member>("member_upsert", { spaceId, displayName }),
  memberList: (spaceId: string) =>
    invoke<Member[]>("member_list", { spaceId }),

  pageList: (spaceId: string) => invoke<Page[]>("page_list", { spaceId }),
  pageCreate: (spaceId: string, title: string, parentId: string | null = null) =>
    invoke<Page>("page_create", { spaceId, title, parentId }),
  pageGet: (spaceId: string, id: string) =>
    invoke<PageWithBody | null>("page_get", { spaceId, id }),
  pageUpdate: (
    spaceId: string,
    id: string,
    title: string | null,
    body: string | null,
  ) => invoke<Page>("page_update", { spaceId, id, title, body }),
  pageDelete: (spaceId: string, id: string) =>
    invoke<void>("page_delete", { spaceId, id }),

  fileList: (spaceId: string) => invoke<FileMeta[]>("file_list", { spaceId }),
  fileUpload: (spaceId: string, sourcePath: string) =>
    invoke<FileMeta>("file_upload", { spaceId, sourcePath }),
  fileExport: (spaceId: string, id: string, targetPath: string) =>
    invoke<FileMeta>("file_export", { spaceId, id, targetPath }),
  fileDefaultDownloadPath: (name: string) =>
    invoke<string>("file_default_download_path", { name }),
  fileReadPreview: (spaceId: string, id: string, maxBytes = 16 * 1024 * 1024) =>
    invoke<{ meta: FileMeta; bytes: number[] }>("file_read_preview", {
      spaceId,
      id,
      maxBytes,
    }),
};
