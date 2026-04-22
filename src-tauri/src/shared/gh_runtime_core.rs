use std::env;
use std::io::ErrorKind;
use std::path::PathBuf;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum GhRuntimeSource {
    Custom,
    Path,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct ResolvedGhRuntime {
    pub(crate) program: String,
    pub(crate) source: GhRuntimeSource,
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

    if let Some(path_binary) = resolve_path_gh_binary() {
        return Ok(ResolvedGhRuntime {
            program: path_binary.to_string_lossy().to_string(),
            source: GhRuntimeSource::Path,
        });
    }

    Err("GitHub CLI is unavailable. Install `gh` or ensure it is on PATH.".to_string())
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
        return "GitHub CLI is unavailable. Install `gh` or ensure it is on PATH.".to_string();
    }
    format!("Failed to run GitHub CLI: {error}")
}

#[cfg(test)]
mod tests {
    use super::{
        format_gh_command_error, gh_command_env, resolve_gh_runtime, resolve_path_gh_binary,
        GhRuntimeSource,
    };
    use std::env;
    use std::fs;
    use std::path::PathBuf;
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

    fn with_env_vars<T>(vars: &[(&str, Option<&std::ffi::OsStr>)], run: impl FnOnce() -> T) -> T {
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
    fn explicit_runtime_bin_beats_path_lookup() {
        let resolved = with_env_vars(&[("PATH", Some(std::ffi::OsStr::new("")))], || {
            resolve_gh_runtime(Some("/tmp/custom-gh")).expect("resolve runtime")
        });
        assert_eq!(resolved.program, "/tmp/custom-gh");
        assert_eq!(resolved.source, GhRuntimeSource::Custom);
    }

    #[test]
    fn invalid_custom_runtime_path_fails_fast() {
        let missing_path = create_temp_file("placeholder");
        fs::remove_file(&missing_path).expect("remove placeholder");

        let error = with_env_vars(
            &[("CODEX_MONITOR_GH_PATH", Some(missing_path.as_os_str()))],
            || resolve_gh_runtime(None),
        )
        .expect_err("invalid custom path should fail");

        assert!(error.contains("Configured GitHub CLI path is unavailable"));
    }

    #[test]
    fn path_lookup_is_used_when_available() {
        let path_name = if cfg!(windows) { "gh.exe" } else { "gh" };
        let temp_path = create_temp_file(path_name);
        let temp_dir = temp_path.parent().expect("parent").to_path_buf();
        let resolved = with_env_vars(
            &[
                ("CODEX_MONITOR_GH_PATH", None),
                ("PATH", Some(temp_dir.as_os_str())),
            ],
            resolve_path_gh_binary,
        );
        assert_eq!(resolved, Some(temp_path));
    }

    #[test]
    fn resolve_runtime_prefers_path_lookup_when_available() {
        let path_name = if cfg!(windows) { "gh.exe" } else { "gh" };
        let temp_path = create_temp_file(path_name);
        let temp_dir = temp_path.parent().expect("parent").to_path_buf();
        let resolved = with_env_vars(
            &[
                ("CODEX_MONITOR_GH_PATH", None),
                ("PATH", Some(temp_dir.as_os_str())),
            ],
            || resolve_gh_runtime(None).expect("resolve runtime"),
        );

        assert_eq!(resolved.program, temp_path.to_string_lossy().to_string());
        assert_eq!(resolved.source, GhRuntimeSource::Path);
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
        assert!(env
            .iter()
            .any(|(key, value)| key == "GH_NO_UPDATE_NOTIFIER" && value == "1"));
        assert!(env
            .iter()
            .any(|(key, value)| key == "GH_NO_EXTENSION_UPDATE_NOTIFIER" && value == "1"));
        assert!(env
            .iter()
            .any(|(key, value)| key == "GH_PROMPT_DISABLED" && value == "1"));
    }
}
