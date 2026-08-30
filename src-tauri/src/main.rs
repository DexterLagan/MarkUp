use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{Emitter, Manager};

#[tauri::command]
fn drain_opened_files(state: tauri::State<Mutex<Vec<PathBuf>>>) -> Vec<String> {
    state
        .lock()
        .map(|mut queue| {
            queue
                .drain(..)
                .map(|path| path.to_string_lossy().into_owned())
                .collect()
        })
        .unwrap_or_default()
}

fn main() {
    let opened: Mutex<Vec<PathBuf>> = Mutex::new(Vec::new());
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(opened)
        .invoke_handler(tauri::generate_handler![drain_opened_files])
        .build(tauri::generate_context!())
        .expect("error while running MarkUp");

    app.run(|app_handle, event| {
        if let tauri::RunEvent::Opened { urls } = &event {
            if let Some(url) = urls.last() {
                if let Ok(path) = url.to_file_path() {
                    if let Ok(mut queue) = app_handle.state::<Mutex<Vec<PathBuf>>>().lock() {
                        queue.push(path.clone());
                    }
                    let _ = app_handle.emit(
                        "markup://open-file",
                        path.to_string_lossy().into_owned(),
                    );
                }
            }
        }
    });
}
