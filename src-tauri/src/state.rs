use std::collections::HashMap;
use std::sync::Arc;

use anyhow::Result;
use tokio::sync::Mutex;

use crate::iroh::space::Space;
use crate::iroh::IrohNode;

pub struct AppState {
    pub node: Arc<IrohNode>,
    pub spaces: Mutex<HashMap<String, Arc<Space>>>,
}

impl AppState {
    pub fn new(node: Arc<IrohNode>) -> Self {
        Self {
            node,
            spaces: Mutex::new(HashMap::new()),
        }
    }

    pub async fn get_space(&self, id: &str) -> Option<Arc<Space>> {
        self.spaces.lock().await.get(id).cloned()
    }

    pub async fn insert_space(&self, space: Arc<Space>) {
        let id = space.id_string();
        self.spaces.lock().await.insert(id, space);
    }

    pub async fn remove_space(&self, id: &str) -> Result<()> {
        if let Some(space) = self.spaces.lock().await.remove(id) {
            let _ = space.close().await;
        }
        Ok(())
    }
}
