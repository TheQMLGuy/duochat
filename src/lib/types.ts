export interface Identity {
  node_id: string;
  author_id: string;
}

export interface SpaceInfo {
  id: string;
  label: string;
}

export interface CreatedSpace {
  space_id: string;
  ticket: string;
}

export interface Category {
  id: string;
  name: string;
  position: number;
  created_at: number;
}

export interface Channel {
  id: string;
  name: string;
  category_id: string | null;
  position: number;
  created_at: number;
  description: string;
}

export interface Thread {
  id: string;
  channel_id: string;
  parent_message_id: string;
  name: string;
  created_at: number;
}

export interface Message {
  id: string;
  channel_id: string;
  thread_id: string | null;
  author: string;
  content: string;
  created_at: number;
}

export interface Reaction {
  message_id: string;
  author: string;
  emoji: string;
}

export interface Member {
  node_id: string;
  display_name: string;
  updated_at: number;
}

export interface Page {
  id: string;
  title: string;
  parent_id: string | null;
  created_by: string;
  created_at: number;
  updated_at: number;
}

export interface PageWithBody {
  page: Page;
  body: string;
}

export interface FileMeta {
  id: string;
  name: string;
  mime: string;
  size: number;
  hash: string;
  uploaded_by: string;
  uploaded_at: number;
}

export type SpaceEvent =
  | { kind: "insert_local"; space_id: string; key: string }
  | { kind: "insert_remote"; space_id: string; key: string; from: string }
  | { kind: "content_ready"; space_id: string; hash: string }
  | { kind: "neighbor_up"; space_id: string; node_id: string }
  | { kind: "neighbor_down"; space_id: string; node_id: string }
  | { kind: "sync_finished"; space_id: string }
  | { kind: "pending_content_ready"; space_id: string };
