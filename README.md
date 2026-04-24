# duochat

Peer-to-peer collaboration for two-person teams. Discord-style channels,
categories and threads, backed by [iroh](https://iroh.computer) — no servers,
no accounts, just you and your partner.

> **Status:** chat-first MVP. File attachments, task management, and the local
> AI assistant are planned follow-up milestones.

## Stack

- **Tauri 2** — one Rust backend, ships to macOS / Windows / Linux / iOS / Android.
- **React + TypeScript + Vite** frontend with Tailwind for styling and Zustand
  for state.
- **iroh + iroh-docs + iroh-gossip + iroh-blobs** for peer-to-peer transport,
  CRDT state sync, and content-addressed storage.
- **Ollama** (external, later milestone) for the local AI assistant.

## Requirements

- Rust (stable), `cargo`
- Node 20+ and pnpm
- Linux only (for desktop dev): `libgtk-3-dev`, `libwebkit2gtk-4.1-dev`,
  `libayatana-appindicator3-dev`, `librsvg2-dev`, `libsoup-3.0-dev`
- iOS builds require macOS; Android builds require the Android SDK + NDK.

## Develop

```bash
pnpm install
pnpm tauri dev            # desktop
pnpm tauri android dev    # Android (after `pnpm tauri android init`)
pnpm tauri ios dev        # iOS (macOS only, after `pnpm tauri ios init`)
```

The first run generates a persistent Ed25519 identity under the platform app
data directory (`~/.local/share/com.duochat.app/duochat/` on Linux, and
analogous paths elsewhere). Your iroh blobs and docs live alongside it.

## Pair up

1. Peer A launches the app → **Start a new space** → copies the ticket (or
   shares the QR).
2. Peer B launches the app → **Join with a ticket** → pastes the ticket.
3. Within a few seconds both peers see the same sidebar. Create categories and
   channels on either side; changes sync bidirectionally via iroh-docs.

## Data model

Everything for a space lives in a single iroh-docs document, keyed by short
prefixes:

| Key prefix                                           | Holds                             |
| ---------------------------------------------------- | --------------------------------- |
| `meta/category/{id}`                                 | Category                          |
| `meta/channel/{id}`                                  | Channel                           |
| `meta/thread/{id}`                                   | Thread                            |
| `meta/member/{node_id}`                              | Member profile                    |
| `msg/{channel_or_thread_id}/{ts}/{author}/{nonce}`   | Message                           |
| `reaction/{message_id}/{author}/{emoji}`             | Reaction                          |

One doc per space keeps pairing to a single ticket and the CRDT
range-reconciliation story simple. Messages are per-channel-scoped by prefix,
so fetching a channel's history is a prefix scan.

## Layout

- Desktop (≥ `md` breakpoint): three-pane — spaces rail + channels, chat,
  threads panel.
- Mobile: single-pane with a drawer for channels and a sheet for threads.

## Backend commands

See `src-tauri/src/commands.rs` for the full list. Everything the frontend
needs funnels through `src/lib/tauri.ts`.

Events emitted back to the frontend (`space:event`):

- `insert_local` / `insert_remote` — a CRDT entry was inserted (prompts a
  targeted re-fetch of the affected scope)
- `neighbor_up` / `neighbor_down` — a peer joined or left the swarm
- `sync_finished`, `content_ready`, `pending_content_ready` — post-sync
  hints

## Follow-up milestones

- File attachments via `iroh-blobs` piped through the composer.
- Task management (assignable tasks inside a channel).
- Local AI assistant — Ollama over `localhost`, per-space context.
