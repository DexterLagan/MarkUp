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

/// Queue an opened file in Rust state and notify the frontend. The queue
/// survives a frontend that isn't up yet (drained at startup); the event
/// handles live opens while the app is already running.
fn push_and_emit(app_handle: &tauri::AppHandle, path: &PathBuf) {
    if let Ok(mut queue) = app_handle.state::<Mutex<Vec<PathBuf>>>().lock() {
        queue.push(path.clone());
    }
    let _ = app_handle.emit(
        "markup://open-file",
        path.to_string_lossy().into_owned(),
    );
}

/// First existing file path in the current process's command line.
#[cfg(target_os = "macos")]
fn file_path_from_args() -> Option<PathBuf> {
    None
}

/// On Windows and Linux the OS passes the file to open as a launch argument
/// (macOS delivers opens via `RunEvent::Opened` instead).
#[cfg(not(target_os = "macos"))]
fn file_path_from_args() -> Option<PathBuf> {
    std::env::args()
        .skip(1)
        .find_map(|arg| {
            let path = PathBuf::from(arg);
            path.is_file().then_some(path)
        })
}

#[cfg(target_os = "macos")]
fn on_run_event(app_handle: &tauri::AppHandle, event: &tauri::RunEvent) {
    if let tauri::RunEvent::Opened { urls } = event {
        if let Some(url) = urls.last() {
            if let Ok(path) = url.to_file_path() {
                push_and_emit(app_handle, &path);
            }
        }
    }
}

#[cfg(not(target_os = "macos"))]
fn on_run_event(_app_handle: &tauri::AppHandle, _event: &tauri::RunEvent) {}

fn main() {
    let opened: Mutex<Vec<PathBuf>> = Mutex::new(Vec::new());

    // Cold launch: the OS handed us a file to open on the command line.
    if let Some(path) = file_path_from_args() {
        if let Ok(mut queue) = opened.lock() {
            queue.push(path);
        }
    }

    let app = tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        // Keep the app to a single instance: when a file is opened while the
        // app is already running (double-click on Windows/Linux re-launches a
        // process), forward the path to the running instance and exit.
        .plugin(tauri_plugin_single_instance::init(
            |app_handle, args, _cwd| {
                if let Some(arg) = args.iter().skip(1).find(|a| std::path::Path::new(a).is_file()) {
                    push_and_emit(app_handle, &PathBuf::from(arg));
                }
            },
        ))
        .manage(opened)
        .invoke_handler(tauri::generate_handler![drain_opened_files])
        .build(tauri::generate_context!())
        .expect("error while running MarkUp");

    app.run(|app_handle, event| on_run_event(app_handle, &event));
}
