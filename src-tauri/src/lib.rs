use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_shell::process::CommandEvent;
use tauri_plugin_shell::ShellExt;

/// Shared engine state. Currently just a cancellation flag — extended later
/// when we add queue / batch conversion support.
#[derive(Default)]
pub struct EngineState {
    pub cancel_requested: AtomicBool,
    pub jobs_run: AtomicU64,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConvertArgs {
    /// Absolute path to the input video on disk.
    pub input_path: String,
    /// Absolute path where the MP4 should be written.
    pub output_path: String,
    /// Format id from lib/formats.ts (e.g. "ts", "mov", "mkv"). Used to pick
    /// format-specific bitstream filters.
    pub format_id: String,
    /// Whether to attempt a remux pass before falling back to encode.
    pub try_remux: bool,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProgressEvent {
    pub stage: String, // "remuxing" | "encoding" | "done"
    pub media_time_sec: Option<f64>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LogEvent {
    pub level: String, // "info" | "warn" | "error" | "ffmpeg"
    pub message: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConvertResult {
    pub mode: String, // "remux" | "encode"
    pub output_path: String,
    pub duration_ms: u128,
}

/// Build the remux argv. Mirrors lib/converter-engine.ts runRemux().
fn remux_args(input: &str, output: &str, format_id: &str) -> Vec<String> {
    let mut args = vec![
        "-y".to_string(),
        "-i".to_string(),
        input.to_string(),
        "-map".to_string(),
        "0:v?".to_string(),
        "-map".to_string(),
        "0:a?".to_string(),
        "-c".to_string(),
        "copy".to_string(),
    ];
    if format_id == "ts" {
        args.push("-bsf:a".to_string());
        args.push("aac_adtstoasc".to_string());
    }
    args.extend([
        "-movflags".to_string(),
        "+faststart".to_string(),
        "-f".to_string(),
        "mp4".to_string(),
        output.to_string(),
    ]);
    args
}

/// Build the encode argv. Mirrors lib/converter-engine.ts runEncode().
fn encode_args(input: &str, output: &str) -> Vec<String> {
    vec![
        "-y".to_string(),
        "-i".to_string(),
        input.to_string(),
        "-c:v".to_string(),
        "libx264".to_string(),
        "-preset".to_string(),
        "veryfast".to_string(),
        "-crf".to_string(),
        "20".to_string(),
        "-c:a".to_string(),
        "aac".to_string(),
        "-b:a".to_string(),
        "192k".to_string(),
        "-movflags".to_string(),
        "+faststart".to_string(),
        "-f".to_string(),
        "mp4".to_string(),
        output.to_string(),
    ]
}

/// Run ffmpeg with the given args, forwarding stderr lines as log/progress
/// events to the webview. Returns the process exit code.
async fn run_ffmpeg(
    app: &AppHandle,
    args: Vec<String>,
    stage_label: &'static str,
) -> Result<i32, String> {
    // ffmpeg is bundled as a sidecar binary, configured in tauri.conf.json
    // externalBin + capabilities/default.json. Tauri rewrites the platform
    // suffix at runtime — we just ask for "ffmpeg".
    let sidecar = app
        .shell()
        .sidecar("ffmpeg")
        .map_err(|e| format!("ffmpeg sidecar not found: {e}"))?;

    let (mut rx, _child) = sidecar
        .args(args)
        .spawn()
        .map_err(|e| format!("failed to spawn ffmpeg: {e}"))?;

    let mut exit_code: i32 = -1;

    while let Some(event) = rx.recv().await {
        match event {
            CommandEvent::Stdout(line) | CommandEvent::Stderr(line) => {
                let text = String::from_utf8_lossy(&line).to_string();
                // Forward to the webview as a log line.
                let _ = app.emit(
                    "ffmpeg-log",
                    LogEvent {
                        level: "ffmpeg".to_string(),
                        message: text.clone(),
                    },
                );
                // Lightweight progress parse: ffmpeg's "time=HH:MM:SS.MS" tokens.
                if let Some(media_time) = parse_progress_time(&text) {
                    let _ = app.emit(
                        "ffmpeg-progress",
                        ProgressEvent {
                            stage: stage_label.to_string(),
                            media_time_sec: Some(media_time),
                        },
                    );
                }
            }
            CommandEvent::Terminated(t) => {
                exit_code = t.code.unwrap_or(-1);
            }
            _ => {}
        }
    }

    Ok(exit_code)
}

/// Extract media seconds from an ffmpeg progress line like
/// "frame= 12345 fps=29 q=20.0 size= 1024KB time=00:01:23.45 bitrate=…"
fn parse_progress_time(line: &str) -> Option<f64> {
    let idx = line.find("time=")?;
    let rest = &line[idx + 5..];
    let token = rest.split_whitespace().next()?;
    // Expect HH:MM:SS.MS
    let mut parts = token.split(':');
    let h: f64 = parts.next()?.parse().ok()?;
    let m: f64 = parts.next()?.parse().ok()?;
    let s: f64 = parts.next()?.parse().ok()?;
    Some(h * 3600.0 + m * 60.0 + s)
}

#[tauri::command]
async fn convert_video(
    app: AppHandle,
    state: State<'_, Arc<EngineState>>,
    args: ConvertArgs,
) -> Result<ConvertResult, String> {
    state.cancel_requested.store(false, Ordering::SeqCst);
    let started = std::time::Instant::now();

    let mut mode = "remux";
    if args.try_remux {
        let remux = remux_args(&args.input_path, &args.output_path, &args.format_id);
        let code = run_ffmpeg(&app, remux, "remuxing").await?;
        if code == 0 && std::fs::metadata(&args.output_path).map(|m| m.len() > 1024).unwrap_or(false)
        {
            state.jobs_run.fetch_add(1, Ordering::Relaxed);
            return Ok(ConvertResult {
                mode: mode.to_string(),
                output_path: args.output_path.clone(),
                duration_ms: started.elapsed().as_millis(),
            });
        }
        let _ = app.emit(
            "ffmpeg-log",
            LogEvent {
                level: "warn".to_string(),
                message: format!("Remux failed (exit {code}); re-encoding…"),
            },
        );
        let _ = std::fs::remove_file(&args.output_path);
    }

    mode = "encode";
    let encode = encode_args(&args.input_path, &args.output_path);
    let code = run_ffmpeg(&app, encode, "encoding").await?;
    if code != 0 {
        return Err(format!(
            "ffmpeg exited with code {code}. The file may be corrupt or use an unsupported codec."
        ));
    }

    state.jobs_run.fetch_add(1, Ordering::Relaxed);
    Ok(ConvertResult {
        mode: mode.to_string(),
        output_path: args.output_path,
        duration_ms: started.elapsed().as_millis(),
    })
}

#[tauri::command]
fn cancel_conversion(state: State<'_, Arc<EngineState>>) {
    state.cancel_requested.store(true, Ordering::SeqCst);
}

#[tauri::command]
fn engine_info(state: State<'_, Arc<EngineState>>) -> serde_json::Value {
    serde_json::json!({
        "native": true,
        "jobsRun": state.jobs_run.load(Ordering::Relaxed),
        "version": env!("CARGO_PKG_VERSION"),
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            app.manage(Arc::new(EngineState::default()));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            convert_video,
            cancel_conversion,
            engine_info,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
