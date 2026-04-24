use std::sync::Arc;

use serde::Serialize;
use tauri::{AppHandle, State};

use crate::events::spawn_forwarder;
use crate::iroh::space::{
    self, Category, Channel, FileMeta, Member, Message, Page, PageWithBody, Reaction, Space,
    SpaceInfo, Thread,
};
use crate::state::AppState;

type CmdResult<T> = Result<T, String>;

fn err<E: std::fmt::Display>(e: E) -> String {
    e.to_string()
}

async fn ensure_space(app: &AppHandle, state: &AppState, id: &str) -> CmdResult<Arc<Space>> {
    if let Some(s) = state.get_space(id).await {
        return Ok(s);
    }
    let space = space::open_space(&state.node, id)
        .await
        .map_err(err)?
        .ok_or_else(|| "space not found".to_string())?;
    let arc = Arc::new(space);
    state.insert_space(arc.clone()).await;
    spawn_forwarder(app.clone(), arc.clone());
    Ok(arc)
}

// --- Identity ---

#[derive(Serialize)]
pub struct Identity {
    pub node_id: String,
    pub author_id: String,
}

#[tauri::command]
pub async fn identity_get(state: State<'_, AppState>) -> CmdResult<Identity> {
    Ok(Identity {
        node_id: state.node.node_id(),
        author_id: state.node.author_id(),
    })
}

// --- Spaces ---

#[derive(Serialize)]
pub struct CreatedSpace {
    pub space_id: String,
    pub ticket: String,
}

#[tauri::command]
pub async fn space_create(
    app: AppHandle,
    state: State<'_, AppState>,
) -> CmdResult<CreatedSpace> {
    let space = space::create_space(&state.node).await.map_err(err)?;
    let ticket = space.share_ticket().await.map_err(err)?;
    let space_id = space.id_string();
    let arc = Arc::new(space);
    state.insert_space(arc.clone()).await;
    spawn_forwarder(app, arc);
    Ok(CreatedSpace {
        space_id,
        ticket: ticket.to_string(),
    })
}

#[tauri::command]
pub async fn space_join(
    app: AppHandle,
    state: State<'_, AppState>,
    ticket: String,
) -> CmdResult<String> {
    let space = space::join_space(&state.node, &ticket)
        .await
        .map_err(err)?;
    let id = space.id_string();
    let arc = Arc::new(space);
    state.insert_space(arc.clone()).await;
    spawn_forwarder(app, arc);
    Ok(id)
}

#[tauri::command]
pub async fn space_list(state: State<'_, AppState>) -> CmdResult<Vec<SpaceInfo>> {
    space::list_spaces(&state.node).await.map_err(err)
}

#[tauri::command]
pub async fn space_open(
    app: AppHandle,
    state: State<'_, AppState>,
    space_id: String,
) -> CmdResult<String> {
    let space = ensure_space(&app, &state, &space_id).await?;
    Ok(space.id_string())
}

#[tauri::command]
pub async fn space_share_ticket(
    app: AppHandle,
    state: State<'_, AppState>,
    space_id: String,
) -> CmdResult<String> {
    let space = ensure_space(&app, &state, &space_id).await?;
    let ticket = space.share_ticket().await.map_err(err)?;
    Ok(ticket.to_string())
}

// --- Categories ---

#[tauri::command]
pub async fn category_list(
    app: AppHandle,
    state: State<'_, AppState>,
    space_id: String,
) -> CmdResult<Vec<Category>> {
    let space = ensure_space(&app, &state, &space_id).await?;
    space.list_categories().await.map_err(err)
}

#[tauri::command]
pub async fn category_create(
    app: AppHandle,
    state: State<'_, AppState>,
    space_id: String,
    name: String,
) -> CmdResult<Category> {
    let space = ensure_space(&app, &state, &space_id).await?;
    space.create_category(name).await.map_err(err)
}

#[tauri::command]
pub async fn category_delete(
    app: AppHandle,
    state: State<'_, AppState>,
    space_id: String,
    id: String,
) -> CmdResult<()> {
    let space = ensure_space(&app, &state, &space_id).await?;
    space.delete_category(&id).await.map_err(err)
}

// --- Channels ---

#[tauri::command]
pub async fn channel_list(
    app: AppHandle,
    state: State<'_, AppState>,
    space_id: String,
) -> CmdResult<Vec<Channel>> {
    let space = ensure_space(&app, &state, &space_id).await?;
    space.list_channels().await.map_err(err)
}

#[tauri::command]
pub async fn channel_create(
    app: AppHandle,
    state: State<'_, AppState>,
    space_id: String,
    name: String,
    category_id: Option<String>,
) -> CmdResult<Channel> {
    let space = ensure_space(&app, &state, &space_id).await?;
    space.create_channel(name, category_id).await.map_err(err)
}

#[tauri::command]
pub async fn channel_rename(
    app: AppHandle,
    state: State<'_, AppState>,
    space_id: String,
    id: String,
    new_name: String,
) -> CmdResult<()> {
    let space = ensure_space(&app, &state, &space_id).await?;
    space.rename_channel(&id, new_name).await.map_err(err)
}

#[tauri::command]
pub async fn channel_delete(
    app: AppHandle,
    state: State<'_, AppState>,
    space_id: String,
    id: String,
) -> CmdResult<()> {
    let space = ensure_space(&app, &state, &space_id).await?;
    space.delete_channel(&id).await.map_err(err)
}

// --- Threads ---

#[tauri::command]
pub async fn thread_list(
    app: AppHandle,
    state: State<'_, AppState>,
    space_id: String,
) -> CmdResult<Vec<Thread>> {
    let space = ensure_space(&app, &state, &space_id).await?;
    space.list_threads().await.map_err(err)
}

#[tauri::command]
pub async fn thread_create(
    app: AppHandle,
    state: State<'_, AppState>,
    space_id: String,
    channel_id: String,
    parent_message_id: String,
    name: String,
) -> CmdResult<Thread> {
    let space = ensure_space(&app, &state, &space_id).await?;
    space
        .create_thread(channel_id, parent_message_id, name)
        .await
        .map_err(err)
}

// --- Messages ---

#[tauri::command]
pub async fn message_list(
    app: AppHandle,
    state: State<'_, AppState>,
    space_id: String,
    channel_id: String,
    thread_id: Option<String>,
    limit: Option<usize>,
) -> CmdResult<Vec<Message>> {
    let space = ensure_space(&app, &state, &space_id).await?;
    space
        .list_messages(&channel_id, thread_id.as_deref(), limit.unwrap_or(200))
        .await
        .map_err(err)
}

#[tauri::command]
pub async fn message_send(
    app: AppHandle,
    state: State<'_, AppState>,
    space_id: String,
    channel_id: String,
    thread_id: Option<String>,
    content: String,
) -> CmdResult<Message> {
    let space = ensure_space(&app, &state, &space_id).await?;
    space
        .send_message(channel_id, thread_id, content)
        .await
        .map_err(err)
}

// --- Reactions ---

#[tauri::command]
pub async fn reaction_toggle(
    app: AppHandle,
    state: State<'_, AppState>,
    space_id: String,
    message_id: String,
    emoji: String,
) -> CmdResult<bool> {
    let space = ensure_space(&app, &state, &space_id).await?;
    space.toggle_reaction(message_id, emoji).await.map_err(err)
}

#[tauri::command]
pub async fn reaction_list(
    app: AppHandle,
    state: State<'_, AppState>,
    space_id: String,
) -> CmdResult<Vec<Reaction>> {
    let space = ensure_space(&app, &state, &space_id).await?;
    space.list_reactions().await.map_err(err)
}

// --- Members ---

#[tauri::command]
pub async fn member_upsert(
    app: AppHandle,
    state: State<'_, AppState>,
    space_id: String,
    display_name: String,
) -> CmdResult<Member> {
    let space = ensure_space(&app, &state, &space_id).await?;
    space.upsert_member(display_name).await.map_err(err)
}

#[tauri::command]
pub async fn member_list(
    app: AppHandle,
    state: State<'_, AppState>,
    space_id: String,
) -> CmdResult<Vec<Member>> {
    let space = ensure_space(&app, &state, &space_id).await?;
    space.list_members().await.map_err(err)
}

// --- Pages ---

#[tauri::command]
pub async fn page_list(
    app: AppHandle,
    state: State<'_, AppState>,
    space_id: String,
) -> CmdResult<Vec<Page>> {
    let space = ensure_space(&app, &state, &space_id).await?;
    space.list_pages().await.map_err(err)
}

#[tauri::command]
pub async fn page_create(
    app: AppHandle,
    state: State<'_, AppState>,
    space_id: String,
    title: String,
    parent_id: Option<String>,
) -> CmdResult<Page> {
    let space = ensure_space(&app, &state, &space_id).await?;
    space.create_page(title, parent_id).await.map_err(err)
}

#[tauri::command]
pub async fn page_get(
    app: AppHandle,
    state: State<'_, AppState>,
    space_id: String,
    id: String,
) -> CmdResult<Option<PageWithBody>> {
    let space = ensure_space(&app, &state, &space_id).await?;
    space.get_page(&id).await.map_err(err)
}

#[tauri::command]
pub async fn page_update(
    app: AppHandle,
    state: State<'_, AppState>,
    space_id: String,
    id: String,
    title: Option<String>,
    body: Option<String>,
) -> CmdResult<Page> {
    let space = ensure_space(&app, &state, &space_id).await?;
    space.update_page(&id, title, body).await.map_err(err)
}

#[tauri::command]
pub async fn page_delete(
    app: AppHandle,
    state: State<'_, AppState>,
    space_id: String,
    id: String,
) -> CmdResult<()> {
    let space = ensure_space(&app, &state, &space_id).await?;
    space.delete_page(&id).await.map_err(err)
}

// --- Files ---

#[tauri::command]
pub async fn file_list(
    app: AppHandle,
    state: State<'_, AppState>,
    space_id: String,
) -> CmdResult<Vec<FileMeta>> {
    let space = ensure_space(&app, &state, &space_id).await?;
    space.list_files().await.map_err(err)
}

#[tauri::command]
pub async fn file_upload(
    app: AppHandle,
    state: State<'_, AppState>,
    space_id: String,
    source_path: String,
) -> CmdResult<FileMeta> {
    let space = ensure_space(&app, &state, &space_id).await?;
    space
        .upload_file(std::path::PathBuf::from(source_path))
        .await
        .map_err(err)
}

#[tauri::command]
pub async fn file_export(
    app: AppHandle,
    state: State<'_, AppState>,
    space_id: String,
    id: String,
    target_path: String,
) -> CmdResult<FileMeta> {
    let space = ensure_space(&app, &state, &space_id).await?;
    space
        .export_file(&id, std::path::PathBuf::from(target_path))
        .await
        .map_err(err)
}

#[tauri::command]
pub async fn file_default_download_path(
    app: AppHandle,
    name: String,
) -> CmdResult<String> {
    use tauri::Manager;
    let dir = app
        .path()
        .download_dir()
        .or_else(|_| app.path().app_data_dir())
        .map_err(err)?;
    let path = dir.join("duochat").join(name);
    Ok(path.to_string_lossy().to_string())
}
