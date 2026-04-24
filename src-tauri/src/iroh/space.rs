//! A "space" is a single iroh-docs document shared between two peers.
//!
//! All state (categories, channels, threads, messages, reactions) lives inside it,
//! keyed by a small set of prefixes. This keeps pairing to a single ticket
//! and keeps the CRDT story simple for a two-peer app.

use std::str::FromStr;

use anyhow::{anyhow, Context, Result};
use futures_util::StreamExt;
use iroh_docs::{
    api::{
        protocol::{AddrInfoOptions, ShareMode},
        Doc,
    },
    engine::LiveEvent,
    store::Query,
    AuthorId, DocTicket, Entry, NamespaceId,
};
use nanoid::nanoid;
use serde::{Deserialize, Serialize};

use super::IrohNode;

const P_CATEGORY: &str = "meta/category/";
const P_CHANNEL: &str = "meta/channel/";
const P_THREAD: &str = "meta/thread/";
const P_MEMBER: &str = "meta/member/";
const P_PAGE: &str = "meta/page/";
const P_FILE: &str = "meta/file/";
const P_PAGE_BODY: &str = "page_body/";
const P_MSG: &str = "msg/"; // msg/{channel_or_thread_id}/{ts_zpad}/{author_short}/{nonce}
const P_REACTION: &str = "reaction/"; // reaction/{message_id}/{author}/{emoji}

fn author_short(author: &AuthorId) -> String {
    author.to_string().chars().take(8).collect()
}

fn pad_ts(ms: u64) -> String {
    format!("{:020}", ms)
}

fn now_ms() -> u64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

fn mime_for(name: &str) -> String {
    let ext = name
        .rsplit('.')
        .next()
        .map(|s| s.to_ascii_lowercase())
        .unwrap_or_default();
    match ext.as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "svg" => "image/svg+xml",
        "pdf" => "application/pdf",
        "md" => "text/markdown",
        "txt" | "log" => "text/plain",
        "json" => "application/json",
        "html" | "htm" => "text/html",
        "csv" => "text/csv",
        "mp4" => "video/mp4",
        "webm" => "video/webm",
        "mp3" => "audio/mpeg",
        "wav" => "audio/wav",
        "zip" => "application/zip",
        _ => "application/octet-stream",
    }
    .to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Category {
    pub id: String,
    pub name: String,
    pub position: i32,
    pub created_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Channel {
    pub id: String,
    pub name: String,
    pub category_id: Option<String>,
    pub position: i32,
    pub created_at: u64,
    #[serde(default)]
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Thread {
    pub id: String,
    pub channel_id: String,
    pub parent_message_id: String,
    pub name: String,
    pub created_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub id: String,
    pub channel_id: String,
    pub thread_id: Option<String>,
    pub author: String,
    pub content: String,
    pub created_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Member {
    pub node_id: String,
    pub display_name: String,
    pub updated_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Reaction {
    pub message_id: String,
    pub author: String,
    pub emoji: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Page {
    pub id: String,
    pub title: String,
    pub parent_id: Option<String>,
    pub created_by: String,
    pub created_at: u64,
    pub updated_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PageWithBody {
    pub page: Page,
    pub body: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileMeta {
    pub id: String,
    pub name: String,
    pub mime: String,
    pub size: u64,
    pub hash: String,
    pub uploaded_by: String,
    pub uploaded_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpaceInfo {
    pub id: String,
    pub label: String,
}

pub struct Space {
    pub doc: Doc,
    pub author: AuthorId,
    pub blobs: iroh_blobs::store::fs::FsStore,
}

impl Space {
    pub fn id(&self) -> NamespaceId {
        self.doc.id()
    }

    pub fn id_string(&self) -> String {
        self.doc.id().to_string()
    }

    pub async fn share_ticket(&self) -> Result<DocTicket> {
        self.doc
            .share(ShareMode::Write, AddrInfoOptions::RelayAndAddresses)
            .await
            .context("share doc")
    }

    async fn read_entry(&self, entry: &Entry) -> Result<Vec<u8>> {
        if entry.content_len() == 0 {
            return Ok(Vec::new());
        }
        let bytes = self
            .blobs
            .blobs()
            .get_bytes(entry.content_hash())
            .await
            .map_err(|e| anyhow!("read blob: {e}"))?;
        Ok(bytes.to_vec())
    }

    async fn get_json<T: serde::de::DeserializeOwned>(
        &self,
        entry: &Entry,
    ) -> Result<Option<T>> {
        let bytes = self.read_entry(entry).await?;
        if bytes.is_empty() {
            return Ok(None);
        }
        let v = serde_json::from_slice(&bytes).context("decode entry json")?;
        Ok(Some(v))
    }

    async fn set_json<T: Serialize>(&self, key: impl Into<bytes::Bytes>, value: &T) -> Result<()> {
        let encoded = serde_json::to_vec(value).context("encode entry json")?;
        self.doc
            .set_bytes(self.author, key, encoded)
            .await
            .context("set_bytes")?;
        Ok(())
    }

    // --- Categories ---

    pub async fn create_category(&self, name: String) -> Result<Category> {
        let category = Category {
            id: nanoid!(12),
            name,
            position: now_ms() as i32,
            created_at: now_ms(),
        };
        let key = format!("{}{}", P_CATEGORY, category.id);
        self.set_json(key, &category).await?;
        Ok(category)
    }

    pub async fn list_categories(&self) -> Result<Vec<Category>> {
        let query = Query::key_prefix(P_CATEGORY).build();
        self.collect_json::<Category>(query).await
    }

    pub async fn delete_category(&self, id: &str) -> Result<()> {
        let key = format!("{}{}", P_CATEGORY, id);
        self.doc.del(self.author, key).await?;
        Ok(())
    }

    // --- Channels ---

    pub async fn create_channel(
        &self,
        name: String,
        category_id: Option<String>,
    ) -> Result<Channel> {
        let channel = Channel {
            id: nanoid!(12),
            name,
            category_id,
            position: now_ms() as i32,
            created_at: now_ms(),
            description: String::new(),
        };
        let key = format!("{}{}", P_CHANNEL, channel.id);
        self.set_json(key, &channel).await?;
        Ok(channel)
    }

    pub async fn list_channels(&self) -> Result<Vec<Channel>> {
        let query = Query::key_prefix(P_CHANNEL).build();
        self.collect_json::<Channel>(query).await
    }

    pub async fn rename_channel(&self, id: &str, new_name: String) -> Result<()> {
        let key = format!("{}{}", P_CHANNEL, id);
        let Some(entry) = self.doc.get_exact(self.author, key.as_bytes(), false).await? else {
            return Err(anyhow!("channel not found"));
        };
        let Some(mut channel) = self.get_json::<Channel>(&entry).await? else {
            return Err(anyhow!("channel payload missing"));
        };
        channel.name = new_name;
        self.set_json(key, &channel).await?;
        Ok(())
    }

    pub async fn delete_channel(&self, id: &str) -> Result<()> {
        let key = format!("{}{}", P_CHANNEL, id);
        self.doc.del(self.author, key).await?;
        Ok(())
    }

    // --- Threads ---

    pub async fn create_thread(
        &self,
        channel_id: String,
        parent_message_id: String,
        name: String,
    ) -> Result<Thread> {
        let thread = Thread {
            id: nanoid!(12),
            channel_id,
            parent_message_id,
            name,
            created_at: now_ms(),
        };
        let key = format!("{}{}", P_THREAD, thread.id);
        self.set_json(key, &thread).await?;
        Ok(thread)
    }

    pub async fn list_threads(&self) -> Result<Vec<Thread>> {
        let query = Query::key_prefix(P_THREAD).build();
        self.collect_json::<Thread>(query).await
    }

    // --- Messages ---

    pub async fn send_message(
        &self,
        channel_id: String,
        thread_id: Option<String>,
        content: String,
    ) -> Result<Message> {
        let ts = now_ms();
        let id = nanoid!(10);
        let msg = Message {
            id: id.clone(),
            channel_id: channel_id.clone(),
            thread_id: thread_id.clone(),
            author: self.author.to_string(),
            content,
            created_at: ts,
        };
        let scope = thread_id.clone().unwrap_or_else(|| channel_id.clone());
        let key = format!(
            "{}{}/{}/{}/{}",
            P_MSG,
            scope,
            pad_ts(ts),
            author_short(&self.author),
            id
        );
        self.set_json(key, &msg).await?;
        Ok(msg)
    }

    pub async fn list_messages(
        &self,
        channel_id: &str,
        thread_id: Option<&str>,
        limit: usize,
    ) -> Result<Vec<Message>> {
        let scope = thread_id.unwrap_or(channel_id);
        let prefix = format!("{}{}/", P_MSG, scope);
        let query = Query::key_prefix(prefix).build();
        let mut messages = self.collect_json::<Message>(query).await?;
        messages.sort_by_key(|m| m.created_at);
        if messages.len() > limit {
            let cut = messages.len() - limit;
            messages.drain(..cut);
        }
        Ok(messages)
    }

    // --- Reactions ---

    pub async fn toggle_reaction(
        &self,
        message_id: String,
        emoji: String,
    ) -> Result<bool> {
        let key = format!(
            "{}{}/{}/{}",
            P_REACTION,
            message_id,
            self.author,
            emoji
        );
        let existing = self
            .doc
            .get_exact(self.author, key.as_bytes(), false)
            .await?;
        if existing.is_some() {
            self.doc.del(self.author, key).await?;
            Ok(false)
        } else {
            let r = Reaction {
                message_id,
                author: self.author.to_string(),
                emoji,
            };
            self.set_json(key, &r).await?;
            Ok(true)
        }
    }

    pub async fn list_reactions(&self) -> Result<Vec<Reaction>> {
        let query = Query::key_prefix(P_REACTION).build();
        self.collect_json::<Reaction>(query).await
    }

    // --- Members (presence-ish) ---

    pub async fn upsert_member(&self, display_name: String) -> Result<Member> {
        let node_id = self.author.to_string();
        let member = Member {
            node_id: node_id.clone(),
            display_name,
            updated_at: now_ms(),
        };
        let key = format!("{}{}", P_MEMBER, node_id);
        self.set_json(key, &member).await?;
        Ok(member)
    }

    pub async fn list_members(&self) -> Result<Vec<Member>> {
        let query = Query::key_prefix(P_MEMBER).build();
        self.collect_json::<Member>(query).await
    }

    // --- Pages (Notion-style markdown notes) ---

    pub async fn create_page(
        &self,
        title: String,
        parent_id: Option<String>,
    ) -> Result<Page> {
        let now = now_ms();
        let page = Page {
            id: nanoid!(12),
            title,
            parent_id,
            created_by: self.author.to_string(),
            created_at: now,
            updated_at: now,
        };
        let key = format!("{}{}", P_PAGE, page.id);
        self.set_json(key, &page).await?;
        // Create empty body
        let body_key = format!("{}{}", P_PAGE_BODY, page.id);
        self.doc
            .set_bytes(self.author, body_key, Vec::<u8>::new())
            .await?;
        Ok(page)
    }

    pub async fn list_pages(&self) -> Result<Vec<Page>> {
        let query = Query::key_prefix(P_PAGE).build();
        self.collect_json::<Page>(query).await
    }

    pub async fn get_page(&self, id: &str) -> Result<Option<PageWithBody>> {
        let meta_key = format!("{}{}", P_PAGE, id);
        let Some(meta_entry) = self.doc.get_exact(self.author, meta_key.as_bytes(), false).await? else {
            return Ok(None);
        };
        let Some(page) = self.get_json::<Page>(&meta_entry).await? else {
            return Ok(None);
        };
        let body_key = format!("{}{}", P_PAGE_BODY, id);
        let body = if let Some(body_entry) = self.doc.get_one(Query::key_exact(body_key.as_bytes()).build()).await? {
            let bytes = self.read_entry(&body_entry).await?;
            String::from_utf8(bytes).unwrap_or_default()
        } else {
            String::new()
        };
        Ok(Some(PageWithBody { page, body }))
    }

    pub async fn update_page(
        &self,
        id: &str,
        title: Option<String>,
        body: Option<String>,
    ) -> Result<Page> {
        let meta_key = format!("{}{}", P_PAGE, id);
        let Some(entry) = self.doc.get_exact(self.author, meta_key.as_bytes(), false).await? else {
            return Err(anyhow!("page not found"));
        };
        let Some(mut page) = self.get_json::<Page>(&entry).await? else {
            return Err(anyhow!("page payload missing"));
        };
        if let Some(t) = title {
            page.title = t;
        }
        page.updated_at = now_ms();
        self.set_json(meta_key, &page).await?;
        if let Some(b) = body {
            let body_key = format!("{}{}", P_PAGE_BODY, id);
            self.doc
                .set_bytes(self.author, body_key, b.into_bytes())
                .await?;
        }
        Ok(page)
    }

    pub async fn delete_page(&self, id: &str) -> Result<()> {
        let meta_key = format!("{}{}", P_PAGE, id);
        let body_key = format!("{}{}", P_PAGE_BODY, id);
        self.doc.del(self.author, meta_key).await?;
        self.doc.del(self.author, body_key).await?;
        Ok(())
    }

    // --- Files (iroh-blobs backed) ---

    pub async fn upload_file(&self, source_path: std::path::PathBuf) -> Result<FileMeta> {
        let metadata = tokio::fs::metadata(&source_path)
            .await
            .with_context(|| format!("read metadata for {}", source_path.display()))?;
        let size = metadata.len();
        let name = source_path
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| "untitled".to_string());
        let mime = mime_for(&name);

        let tag = self
            .blobs
            .blobs()
            .add_path(&source_path)
            .await
            .map_err(|e| anyhow!("add file to blobs: {e}"))?;
        let hash = tag.hash;

        // Reference the blob from a doc entry so it syncs to the peer.
        let blob_key = format!("blob/{}", hash);
        self.doc
            .set_hash(self.author, blob_key.as_bytes().to_vec(), hash, size)
            .await?;

        let meta = FileMeta {
            id: nanoid!(12),
            name,
            mime,
            size,
            hash: hash.to_string(),
            uploaded_by: self.author.to_string(),
            uploaded_at: now_ms(),
        };
        let key = format!("{}{}", P_FILE, meta.id);
        self.set_json(key, &meta).await?;
        Ok(meta)
    }

    pub async fn list_files(&self) -> Result<Vec<FileMeta>> {
        let query = Query::key_prefix(P_FILE).build();
        self.collect_json::<FileMeta>(query).await
    }

    pub async fn get_file(&self, id: &str) -> Result<Option<FileMeta>> {
        let key = format!("{}{}", P_FILE, id);
        let Some(entry) = self.doc.get_exact(self.author, key.as_bytes(), false).await? else {
            return Ok(None);
        };
        self.get_json::<FileMeta>(&entry).await
    }

    pub async fn read_file_bytes(&self, id: &str, max_size: u64) -> Result<(FileMeta, Vec<u8>)> {
        let Some(meta) = self.get_file(id).await? else {
            return Err(anyhow!("file not found"));
        };
        if meta.size > max_size {
            return Err(anyhow!(
                "file too large for preview ({} bytes > {} limit)",
                meta.size,
                max_size
            ));
        }
        let hash = iroh_blobs::Hash::from_str(&meta.hash)
            .map_err(|e| anyhow!("parse hash: {e}"))?;
        let bytes = self
            .blobs
            .blobs()
            .get_bytes(hash)
            .await
            .map_err(|e| anyhow!("read blob: {e}"))?;
        Ok((meta, bytes.to_vec()))
    }

    pub async fn export_file(&self, id: &str, target: std::path::PathBuf) -> Result<FileMeta> {
        let Some(meta) = self.get_file(id).await? else {
            return Err(anyhow!("file not found"));
        };
        let hash = iroh_blobs::Hash::from_str(&meta.hash)
            .map_err(|e| anyhow!("parse hash: {e}"))?;
        if let Some(parent) = target.parent() {
            tokio::fs::create_dir_all(parent).await.ok();
        }
        self.blobs
            .blobs()
            .export(hash, &target)
            .await
            .map_err(|e| anyhow!("export blob: {e}"))?;
        Ok(meta)
    }

    // --- Helpers ---

    async fn collect_json<T: serde::de::DeserializeOwned>(&self, query: Query) -> Result<Vec<T>> {
        let stream = self.doc.get_many(query).await?;
        let mut stream = Box::pin(stream);
        let mut out = Vec::new();
        while let Some(entry) = stream.next().await {
            let entry = entry?;
            if let Some(v) = self.get_json::<T>(&entry).await? {
                out.push(v);
            }
        }
        Ok(out)
    }

    pub async fn subscribe(
        &self,
    ) -> Result<impl futures_util::Stream<Item = Result<LiveEvent>> + Send + Unpin + 'static> {
        self.doc.subscribe().await
    }

    pub async fn close(&self) -> Result<()> {
        self.doc.close().await
    }
}

pub async fn create_space(node: &IrohNode) -> Result<Space> {
    let doc = node.docs.create().await.context("create doc")?;
    Ok(Space {
        doc,
        author: node.author,
        blobs: node.blobs.clone(),
    })
}

pub async fn join_space(node: &IrohNode, ticket_str: &str) -> Result<Space> {
    let ticket = DocTicket::from_str(ticket_str).context("parse doc ticket")?;
    let doc = node.docs.import(ticket).await.context("import doc")?;
    Ok(Space {
        doc,
        author: node.author,
        blobs: node.blobs.clone(),
    })
}

pub async fn open_space(node: &IrohNode, id_str: &str) -> Result<Option<Space>> {
    let id = NamespaceId::from_str(id_str).map_err(|e| anyhow!("invalid space id: {e}"))?;
    let doc = node.docs.open(id).await.context("open doc")?;
    Ok(doc.map(|doc| Space {
        doc,
        author: node.author,
        blobs: node.blobs.clone(),
    }))
}

pub async fn list_spaces(node: &IrohNode) -> Result<Vec<SpaceInfo>> {
    let mut stream = node.docs.list().await.context("list docs")?;
    let mut out = Vec::new();
    while let Some(item) = stream.next().await {
        let (id, _cap) = item?;
        out.push(SpaceInfo {
            id: id.to_string(),
            label: id.to_string(),
        });
    }
    Ok(out)
}
