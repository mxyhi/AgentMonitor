use std::env;
use std::io::ErrorKind;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum GhRuntimeSource {
    Custom,
    Bundled,
    Path,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct ResolvedGhRuntime {
    pub(crate) program: String,
    pub(crate) source: GhRuntimeSource,
}

// Build scripts read this version directly from source to keep the bundled asset tag in sync.
#[allow(dead_code)]
pub(crate) const BUNDLED_GH_VERSION: &str = "2.90.0";
pub(crate) const BUNDLED_GH_SIDECAR_NAME: &str = "gh-bundled";

fn bundled_gh_target_triple_for(target_os: &str, target_arch: &str) -> &'static str {
    match (target_os, target_arch) {
        ("macos", "aarch64") => "aarch64-apple-darwin",
        ("macos", "x86_64") => "x86_64-apple-darwin",
        ("linux", "x86_64") => "x86_64-unknown-linux-gnu",
        ("linux", "aarch64") => "aarch64-unknown-linux-gnu",
        ("windows", "x86_64") => "x86_64-pc-windows-msvc",
        ("windows", "aarch64") => "aarch64-pc-windows-msvc",
        _ => panic!("Unsupported bundled gh target: {target_os}/{target_arch}"),
    }
}

pub(crate) fn bundled_gh_target_triple() -> &'static str {
    bundled_gh_target_triple_for(env::consts::OS, env::consts::ARCH)
}

pub(crate) fn bundled_gh_file_name() -> String {
    if cfg!(target_os = "windows") {
        format!(
            "{}-{}.exe",
            BUNDLED_GH_SIDECAR_NAME,
            bundled_gh_target_triple()
        )
    } else {
        format!("{}-{}", BUNDLED_GH_SIDECAR_NAME, bundled_gh_target_triple())
    }
}

fn bundled_gh_packaged_file_names() -> Vec<String> {
    let mut names = vec![bundled_gh_file_name()];
    let bare_name = if cfg!(target_os = "windows") {
        format!("{BUNDLED_GH_SIDECAR_NAME}.exe")
    } else {
        BUNDLED_GH_SIDECAR_NAME.to_string()
    };
    if !names.iter().any(|name| name == &bare_name) {
        names.push(bare_name);
    }
    names
}

fn candidate_if_exists(path: PathBuf) -> Option<PathBuf> {
    path.is_file().then_some(path)
}

fn find_in_path(binary: &str) -> Option<PathBuf> {
    let path_var = env::var_os("PATH")?;
    for dir in env::split_paths(&path_var) {
        let candidate = dir.join(binary);
        if candidate.is_file() {
            return Some(candidate);
        }
    }
    None
}

fn resolve_custom_gh_path() -> Result<Option<PathBuf>, String> {
    let Some(custom_path) = env::var_os("CODEX_MONITOR_GH_PATH") else {
        return Ok(None);
    };

    let path = PathBuf::from(custom_path);
    if path.is_file() {
        return Ok(Some(path));
    }

    Err(format!(
        "Configured GitHub CLI path is unavailable: {}",
        path.display()
    ))
}

fn resolve_bundled_env_override() -> Option<PathBuf> {
    let override_path = env::var_os("CODEX_MONITOR_BUNDLED_GH_PATH")?;
    candidate_if_exists(PathBuf::from(override_path))
}

fn resolve_dev_bundled_path() -> Option<PathBuf> {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    candidate_if_exists(
        manifest_dir
            .join("binaries")
            .join(bundled_gh_file_name()),
    )
}

fn bundled_candidate_paths_for_exe_dir(exe_dir: &Path) -> Vec<PathBuf> {
    let package_name = env!("CARGO_PKG_NAME");
    let mut candidates = Vec::new();

    for file_name in bundled_gh_packaged_file_names() {
        candidates.push(exe_dir.join(&file_name));
        candidates.push(exe_dir.join("binaries").join(&file_name));
        candidates.push(exe_dir.join("resources").join("binaries").join(&file_name));
        candidates.push(
            exe_dir
                .join("../resources")
                .join("binaries")
                .join(&file_name),
        );
        candidates.push(
            exe_dir
                .join("../Resources")
                .join("binaries")
                .join(&file_name),
        );
        candidates.push(
            exe_dir
                .join("../lib")
                .join(package_name)
                .join("binaries")
                .join(&file_name),
        );
    }

    candidates
}

fn resolve_current_exe_bundled_candidates() -> Vec<PathBuf> {
    let Ok(current_exe) = env::current_exe() else {
        return Vec::new();
    };
    let Some(exe_dir) = current_exe.parent() else {
        return Vec::new();
    };

    bundled_candidate_paths_for_exe_dir(exe_dir)
}

pub(crate) fn resolve_bundled_gh_path() -> Option<PathBuf> {
    resolve_bundled_env_override()
        .or_else(resolve_dev_bundled_path)
        .or_else(|| {
            resolve_current_exe_bundled_candidates()
                .into_iter()
                .find(|candidate| candidate.is_file())
        })
}

fn resolve_path_gh_binary() -> Option<PathBuf> {
    if cfg!(windows) {
        find_in_path("gh.exe").or_else(|| find_in_path("gh"))
    } else {
        find_in_path("gh")
    }
}

pub(crate) fn gh_command_env() -> Vec<(String, String)> {
    vec![
        ("GH_NO_UPDATE_NOTIFIER".to_string(), "1".to_string()),
        (
            "GH_NO_EXTENSION_UPDATE_NOTIFIER".to_string(),
            "1".to_string(),
        ),
        ("GH_PROMPT_DISABLED".to_string(), "1".to_string()),
    ]
}

pub(crate) fn resolve_gh_runtime(requested_bin: Option<&str>) -> Result<ResolvedGhRuntime, String> {
    if let Some(custom_bin) = requested_bin
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
    {
        return Ok(ResolvedGhRuntime {
            program: custom_bin,
            source: GhRuntimeSource::Custom,
        });
    }

    if let Some(custom_path) = resolve_custom_gh_path()? {
        return Ok(ResolvedGhRuntime {
            program: custom_path.to_string_lossy().to_string(),
            source: GhRuntimeSource::Custom,
        });
    }

    if let Some(bundled_path) = resolve_bundled_gh_path() {
        return Ok(ResolvedGhRuntime {
            program: bundled_path.to_string_lossy().to_string(),
            source: GhRuntimeSource::Bundled,
        });
    }

    if let Some(path_binary) = resolve_path_gh_binary() {
        return Ok(ResolvedGhRuntime {
            program: path_binary.to_string_lossy().to_string(),
            source: GhRuntimeSource::Path,
        });
    }

    Err("GitHub CLI is unavailable. Reinstall Agent Monitor or ensure `gh` is on PATH.".to_string())
}

fn command_failure_detail(stdout: &[u8], stderr: &[u8], fallback: &str) -> String {
    let stderr = String::from_utf8_lossy(stderr);
    let stdout = String::from_utf8_lossy(stdout);
    let detail = if stderr.trim().is_empty() {
        stdout.trim()
    } else {
        stderr.trim()
    };

    if detail.is_empty() {
        fallback.to_string()
    } else {
        detail.to_string()
    }
}

fn detail_indicates_auth_required(detail: &str) -> bool {
    let lower = detail.to_lowercase();
    lower.contains("gh auth login")
        || lower.contains("authenticate with github")
        || lower.contains("not logged into any github hosts")
        || lower.contains("authentication failed")
        || lower.contains("authentication required")
}

pub(crate) fn format_gh_command_error(stdout: &[u8], stderr: &[u8]) -> String {
    let detail = command_failure_detail(stdout, stderr, "GitHub CLI command failed.");
    if detail_indicates_auth_required(&detail) {
        return "GitHub CLI is not authenticated. Run `gh auth login --web` in a terminal, then retry."
            .to_string();
    }
    detail
}

pub(crate) fn format_gh_spawn_error(error: &std::io::Error) -> String {
    if error.kind() == ErrorKind::NotFound {
        return "GitHub CLI is unavailable. Reinstall Agent Monitor or ensure `gh` is on PATH."
            .to_string();
    }
    format!("Failed to run GitHub CLI: {error}")
}

#[cfg(test)]
mod tests {
    use super::{
        bundled_candidate_paths_for_exe_dir, bundled_gh_file_name, bundled_gh_target_triple_for,
        format_gh_command_error, gh_command_env, resolve_bundled_gh_path, resolve_gh_runtime,
        resolve_path_gh_binary, GhRuntimeSource, BUNDLED_GH_SIDECAR_NAME,
    };
    use std::env;
    use std::fs;
    use std::path::{Path, PathBuf};
    use std::sync::Mutex;
    use std::time::{SystemTime, UNIX_EPOCH};

    static ENV_LOCK: Mutex<()> = Mutex::new(());

    fn create_temp_file(name: &str) -> PathBuf {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock")
            .as_nanos();
        let dir = env::temp_dir().join(format!("codex-monitor-gh-runtime-test-{unique}"));
        fs::create_dir_all(&dir).expect("create temp dir");
        let path = dir.join(name);
        fs::write(&path, b"stub").expect("write temp file");
        path
    }

    fn with_env_vars<T>(
        vars: &[(&str, Option<&std::ffi::OsStr>)],
        run: impl FnOnce() -> T,
    ) -> T {
        let _guard = ENV_LOCK.lock().expect("lock env");
        let previous = vars
            .iter()
            .map(|(name, _)| ((*name).to_string(), env::var_os(name)))
            .collect::<Vec<_>>();

        for (name, value) in vars {
            if let Some(value) = value {
                env::set_var(name, value);
            } else {
                env::remove_var(name);
            }
        }

        let result = run();

        for (name, value) in previous {
            if let Some(value) = value {
                env::set_var(name, value);
            } else {
                env::remove_var(name);
            }
        }

        result
    }

    #[test]
    fn bundled_runtime_env_override_wins_when_present() {
        let temp_path = create_temp_file(&bundled_gh_file_name());
        let resolved = with_env_vars(
            &[(
                "CODEX_MONITOR_BUNDLED_GH_PATH",
                Some(temp_path.as_os_str()),
            )],
            resolve_bundled_gh_path,
        );
        assert_eq!(resolved, Some(temp_path));
    }

    #[test]
    fn explicit_runtime_bin_beats_bundled_runtime() {
        let temp_path = create_temp_file(&bundled_gh_file_name());
        let resolved = with_env_vars(
            &[(
                "CODEX_MONITOR_BUNDLED_GH_PATH",
                Some(temp_path.as_os_str()),
            )],
            || resolve_gh_runtime(Some("/tmp/custom-gh")).expect("resolve runtime"),
        );
        assert_eq!(resolved.program, "/tmp/custom-gh");
        assert_eq!(resolved.source, GhRuntimeSource::Custom);
    }

    #[test]
    fn bundled_runtime_beats_path_lookup() {
        let temp_path = create_temp_file(&bundled_gh_file_name());
        let resolved = with_env_vars(
            &[
                ("CODEX_MONITOR_BUNDLED_GH_PATH", Some(temp_path.as_os_str())),
                ("PATH", Some(std::ffi::OsStr::new(""))),
            ],
            || resolve_gh_runtime(None).expect("resolve runtime"),
        );
        assert_eq!(resolved.program, temp_path.to_string_lossy().to_string());
        assert_eq!(resolved.source, GhRuntimeSource::Bundled);
    }

    #[test]
    fn path_lookup_is_used_when_available() {
        let path_name = if cfg!(windows) { "gh.exe" } else { "gh" };
        let temp_path = create_temp_file(path_name);
        let temp_dir = temp_path.parent().expect("parent").to_path_buf();
        let resolved = with_env_vars(
            &[
                ("CODEX_MONITOR_BUNDLED_GH_PATH", None),
                ("CODEX_MONITOR_GH_PATH", None),
                ("PATH", Some(temp_dir.as_os_str())),
            ],
            resolve_path_gh_binary,
        );
        assert_eq!(resolved, Some(temp_path));
    }

    #[test]
    fn auth_error_is_upgraded_to_actionable_message() {
        let message = format_gh_command_error(
            b"",
            b"To get started with GitHub CLI, please run: gh auth login",
        );
        assert_eq!(
            message,
            "GitHub CLI is not authenticated. Run `gh auth login --web` in a terminal, then retry."
        );
    }

    #[test]
    fn gh_env_disables_prompts_and_update_notifiers() {
        let env = gh_command_env();
        assert!(env.iter().any(|(key, value)| key == "GH_NO_UPDATE_NOTIFIER" && value == "1"));
        assert!(
            env.iter().any(|(key, value)| key == "GH_NO_EXTENSION_UPDATE_NOTIFIER" && value == "1")
        );
        assert!(env.iter().any(|(key, value)| key == "GH_PROMPT_DISABLED" && value == "1"));
    }

    #[test]
    fn windows_targets_use_msvc_triples() {
        assert_eq!(
            bundled_gh_target_triple_for("windows", "x86_64"),
            "x86_64-pc-windows-msvc"
        );
        assert_eq!(
            bundled_gh_target_triple_for("windows", "aarch64"),
            "aarch64-pc-windows-msvc"
        );
    }

    #[test]
    fn packaged_candidate_paths_include_standard_bundle_locations() {
        let exe_dir = Path::new("/tmp/codex-monitor");
        let candidates = bundled_candidate_paths_for_exe_dir(exe_dir);
        assert!(candidates.iter().any(|path| path.ends_with(bundled_gh_file_name())));
        assert!(
            candidates.iter().any(|path| path.ends_with(format!(
                "Resources/binaries/{BUNDLED_GH_SIDECAR_NAME}"
            )))
                || cfg!(windows)
        );
    }
}
