use std::path::PathBuf;

use tauri::{Emitter, Manager};

mod commands;
mod events;
mod iroh;
mod state;

use commands::*;
use iroh::IrohNode;
use state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info,iroh=warn")),
        )
        .try_init()
        .ok();

    #[allow(unused_mut)]
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_os::init());

    #[cfg(any(target_os = "android", target_os = "ios"))]
    {
        builder = builder.plugin(tauri_plugin_barcode_scanner::init());
    }

    builder
        .setup(|app| {
            let data_dir = resolve_data_dir(&app.handle());
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                match IrohNode::spawn(data_dir).await {
                    Ok(node) => {
                        let state = AppState::new(node);
                        handle.manage(state);
                        let _ = handle.emit("node:ready", ());
                    }
                    Err(err) => {
                        tracing::error!(?err, "failed to start iroh node");
                        let _ = handle.emit("node:error", err.to_string());
                    }
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            identity_get,
            space_create,
            space_join,
            space_list,
            space_open,
            space_share_ticket,
            category_list,
            category_create,
            category_delete,
            channel_list,
            channel_create,
            channel_rename,
            channel_delete,
            thread_list,
            thread_create,
            message_list,
            message_send,
            reaction_toggle,
            reaction_list,
            member_upsert,
            member_list,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn resolve_data_dir(app: &tauri::AppHandle) -> PathBuf {
    app.path()
        .app_data_dir()
        .unwrap_or_else(|_| std::env::temp_dir().join("duochat"))
        .join("duochat")
}
