//! Forward iroh-docs LiveEvents to Tauri events on the main window.

use std::sync::Arc;

use futures_util::StreamExt;
use iroh_docs::engine::LiveEvent;
use serde::Serialize;
use tauri::{AppHandle, Emitter};

use crate::iroh::space::Space;

#[derive(Serialize, Clone)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum SpaceEvent {
    InsertLocal { space_id: String, key: String },
    InsertRemote { space_id: String, key: String, from: String },
    ContentReady { space_id: String, hash: String },
    NeighborUp { space_id: String, node_id: String },
    NeighborDown { space_id: String, node_id: String },
    SyncFinished { space_id: String },
    PendingContentReady { space_id: String },
}

pub fn spawn_forwarder(app: AppHandle, space: Arc<Space>) {
    tokio::spawn(async move {
        let stream = match space.subscribe().await {
            Ok(s) => s,
            Err(err) => {
                tracing::warn!(?err, "subscribe failed");
                return;
            }
        };
        let mut stream = Box::pin(stream);
        let space_id = space.id_string();
        while let Some(ev) = stream.next().await {
            let Ok(ev) = ev else { continue };
            let payload = match ev {
                LiveEvent::InsertLocal { entry } => SpaceEvent::InsertLocal {
                    space_id: space_id.clone(),
                    key: String::from_utf8_lossy(entry.key()).to_string(),
                },
                LiveEvent::InsertRemote { entry, from, .. } => SpaceEvent::InsertRemote {
                    space_id: space_id.clone(),
                    key: String::from_utf8_lossy(entry.key()).to_string(),
                    from: from.to_string(),
                },
                LiveEvent::ContentReady { hash } => SpaceEvent::ContentReady {
                    space_id: space_id.clone(),
                    hash: hash.to_string(),
                },
                LiveEvent::NeighborUp(node) => SpaceEvent::NeighborUp {
                    space_id: space_id.clone(),
                    node_id: node.to_string(),
                },
                LiveEvent::NeighborDown(node) => SpaceEvent::NeighborDown {
                    space_id: space_id.clone(),
                    node_id: node.to_string(),
                },
                LiveEvent::SyncFinished(_) => SpaceEvent::SyncFinished {
                    space_id: space_id.clone(),
                },
                LiveEvent::PendingContentReady => SpaceEvent::PendingContentReady {
                    space_id: space_id.clone(),
                },
            };
            if let Err(err) = app.emit("space:event", payload) {
                tracing::warn!(?err, "emit space event failed");
            }
        }
    });
}
