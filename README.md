# duochat

Peer-to-peer collaboration for two-person teams: **Discord + Notion**, pared
down to just the two of you. Discord-style channels, categories, threads, and
reactions for conversation. Notion-style markdown pages and peer-to-peer files,
referenceable directly inside chat. No servers, no accounts, no organizations.

> **Status:** chat + pages + files + in-composer references are in. Task
> management and the local AI assistant (Ollama) are the next milestones.

## Stack

- **Tauri 2** — one Rust backend, ships to macOS / Windows / Linux / iOS / Android.
- **React + TypeScript + Vite** frontend with Tailwind for styling and Zustand
  for state.
- **iroh + iroh-docs + iroh-gossip + iroh-blobs** for peer-to-peer transport,
  CRDT state sync, and content-addressed file storage.
- **marked + DOMPurify** for safe markdown rendering on page views.

## Download the latest Android debug APK

Every push to this branch triggers a GitHub Actions build that publishes the
debug APK as a GitHub Release. Grab the newest one from the
[Releases page](../../releases) — releases are prefixed with `android-` and
tagged per commit.

Install it with "Install unknown apps" enabled for your file manager or
browser. Debug builds are unsigned.

## Requirements (local dev)

- Rust (stable), `cargo`
- Node 20+ and pnpm
- Linux only (for desktop dev): `libgtk-3-dev`, `libwebkit2gtk-4.1-dev`,
  `libayatana-appindicator3-dev`, `librsvg2-dev`, `libsoup-3.0-dev`
- iOS builds require macOS; Android builds require the Android SDK + NDK.

```bash
pnpm install
pnpm tauri dev            # desktop
pnpm tauri android dev    # Android (after pnpm tauri android init)
pnpm tauri ios dev        # iOS (macOS only, after pnpm tauri ios init)
```

The first run generates a persistent Ed25519 identity under the platform app
data directory. Your iroh blobs, doc replicas, and identity live alongside it.

## Pair up

1. Peer A launches the app → **Start a new space** → copies the ticket (or
   scans the QR).
2. Peer B launches the app → **Join with a ticket** → pastes the ticket.
3. Within a few seconds both peers see the same sidebar. Edits on either side
   sync bidirectionally via iroh-docs.

## Using duochat

The sidebar has three tabs:

- **Chat** — Discord-style channels, categories, threads, and reactions.
- **Pages** — markdown notes with split-pane preview. Auto-saves as you type.
- **Files** — peer-to-peer file storage via iroh-blobs. Upload from any device;
  the blob syncs to your partner on demand.

### References in chat

Type any of the following in the chat composer:

| Trigger         | What you get                                                 |
| --------------- | ------------------------------------------------------------ |
| `[[` + text     | Autocomplete over pages and files. Select one to insert a chip. |
| `@` + text      | Mention your partner. Renders as a colored chip.             |
| `/` at start    | Slash commands: `/page <title>` creates a page and links it; `/file` opens the file picker, uploads via iroh-blobs, and inserts a reference. |

Chips in messages are clickable — a page opens the markdown editor in the
right-hand panel, a file opens a preview with a "Save to Downloads" button.
Under the hood, references are stored in the message body as
`[[page/<id>|<label>]]`, `[[file/<id>|<label>]]`, and `@[<node_id>|<label>]`
tokens, so renames don't break links.

## Data model

Everything for a space lives in a single iroh-docs document, keyed by short
prefixes:

| Key prefix                                            | Holds           |
| ----------------------------------------------------- | --------------- |
| `meta/category/{id}`                                  | Category        |
| `meta/channel/{id}`                                   | Channel         |
| `meta/thread/{id}`                                    | Thread          |
| `meta/member/{node_id}`                               | Member profile  |
| `meta/page/{id}`                                      | Page metadata   |
| `page_body/{id}`                                      | Page markdown   |
| `meta/file/{id}`                                      | File metadata   |
| `blob/{hash}`                                         | Content pointer (empty value, references the hash in iroh-blobs) |
| `msg/{channel_or_thread_id}/{ts}/{author}/{nonce}`    | Message         |
| `reaction/{message_id}/{author}/{emoji}`              | Reaction        |

One doc per space keeps pairing to a single ticket and the CRDT story simple.
Files are uploaded to iroh-blobs first; a `blob/{hash}` entry is then written
into the doc so the content flows to the other peer on sync.

## Layout

- Desktop (≥ `md` breakpoint): three-pane — spaces rail + sidebar with
  Chat/Pages/Files tabs, main chat view, right-hand side panel that switches
  between threads, the page editor, or the file viewer.
- Mobile: sidebar opens as a drawer; the right-hand side panel replaces the
  chat when a page or file is opened.

## Follow-up milestones

- Task management (assignable tasks inside a channel, integrated with chat).
- Local AI assistant — Ollama over `localhost`, per-space context.
- Rich-text / block editor upgrade for pages (currently plain markdown).
- Desktop release builds (not just mobile debug) via GitHub Actions.
