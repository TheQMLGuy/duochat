use std::path::PathBuf;
use std::sync::Arc;

use anyhow::{Context, Result};
use iroh::{endpoint::presets, protocol::Router, Endpoint, SecretKey};
use iroh_blobs::{store::fs::FsStore, BlobsProtocol, ALPN as BLOBS_ALPN};
use iroh_docs::{protocol::Docs, ALPN as DOCS_ALPN, AuthorId};
use iroh_gossip::{net::Gossip, ALPN as GOSSIP_ALPN};
use tokio::fs;

pub mod space;

pub struct IrohNode {
    pub endpoint: Endpoint,
    pub blobs: FsStore,
    pub docs: Docs,
    pub author: AuthorId,
    _router: Router,
    _data_dir: PathBuf,
}

impl IrohNode {
    pub async fn spawn(data_dir: PathBuf) -> Result<Arc<Self>> {
        fs::create_dir_all(&data_dir).await.context("create data dir")?;

        let secret_key = load_or_create_secret_key(&data_dir).await?;

        let endpoint = Endpoint::builder(presets::N0)
            .secret_key(secret_key)
            .bind()
            .await
            .context("bind iroh endpoint")?;

        let blobs_dir = data_dir.join("blobs");
        fs::create_dir_all(&blobs_dir).await.ok();
        let blobs = FsStore::load(&blobs_dir)
            .await
            .context("load blobs store")?;

        let gossip = Gossip::builder().spawn(endpoint.clone());

        let docs_dir = data_dir.join("docs");
        fs::create_dir_all(&docs_dir).await.ok();
        let docs = Docs::persistent(docs_dir)
            .spawn(endpoint.clone(), (*blobs).clone(), gossip.clone())
            .await
            .context("spawn docs protocol")?;

        let author = docs.author_default().await.context("default author")?;

        let router = Router::builder(endpoint.clone())
            .accept(BLOBS_ALPN, BlobsProtocol::new(&blobs, None))
            .accept(GOSSIP_ALPN, gossip)
            .accept(DOCS_ALPN, docs.clone())
            .spawn();

        tracing::info!(node_id = %endpoint.id(), "iroh node ready");

        Ok(Arc::new(Self {
            endpoint,
            blobs,
            docs,
            author,
            _router: router,
            _data_dir: data_dir,
        }))
    }

    pub fn node_id(&self) -> String {
        self.endpoint.id().to_string()
    }

    pub fn author_id(&self) -> String {
        self.author.to_string()
    }
}

async fn load_or_create_secret_key(data_dir: &PathBuf) -> Result<SecretKey> {
    let path = data_dir.join("identity.key");
    if path.exists() {
        let bytes = fs::read(&path).await.context("read identity key")?;
        let arr: [u8; 32] = bytes
            .as_slice()
            .try_into()
            .context("identity key must be 32 bytes")?;
        Ok(SecretKey::from_bytes(&arr))
    } else {
        let key = SecretKey::generate();
        fs::write(&path, key.to_bytes()).await.context("write identity key")?;
        Ok(key)
    }
}
