use std::env;
use std::ffi::OsString;
use std::io::ErrorKind;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum GitRuntimeSource {
    Custom,
    Bundled,
    Path,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct ResolvedGitRuntime {
    pub(crate) program: String,
    pub(crate) source: GitRuntimeSource,
    bundled_root: Option<PathBuf>,
}

// Build scripts read this version directly from source to keep the bundled MinGit asset tag in sync.
#[allow(dead_code)]
pub(crate) const BUNDLED_GIT_WINDOWS_VERSION: &str = "2.54.0.windows.1";
pub(crate) const BUNDLED_GIT_RESOURCE_DIR: &str = "git-bundled";

fn bundled_git_target_triple_for(target_os: &str, target_arch: &str) -> Option<&'static str> {
    match (target_os, target_arch) {
        ("windows", "x86_64") => Some("x86_64-pc-windows-msvc"),
        ("windows", "aarch64") => Some("aarch64-pc-windows-msvc"),
        _ => None,
    }
}

pub(crate) fn bundled_git_target_triple() -> Option<&'static str> {
    bundled_git_target_triple_for(env::consts::OS, env::consts::ARCH)
}

fn windows_bundled_git_program(root: &Path) -> PathBuf {
    root.join("cmd").join("git.exe")
}

fn candidate_if_exists(path: PathBuf) -> Option<PathBuf> {
    path.is_file().then_some(path)
}

fn bundled_root_if_valid(root: PathBuf) -> Option<PathBuf> {
    windows_bundled_git_program(&root).is_file().then_some(root)
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

fn resolve_custom_git_path() -> Result<Option<PathBuf>, String> {
    let Some(custom_path) = env::var_os("CODEX_MONITOR_GIT_PATH") else {
        return Ok(None);
    };

    let path = PathBuf::from(custom_path);
    if path.is_file() {
        return Ok(Some(path));
    }

    Err(format!(
        "Configured Git executable is unavailable: {}",
        path.display()
    ))
}

fn resolve_bundled_env_override() -> Option<PathBuf> {
    let override_root = env::var_os("CODEX_MONITOR_BUNDLED_GIT_ROOT")?;
    bundled_root_if_valid(PathBuf::from(override_root))
}

fn resolve_dev_bundled_root() -> Option<PathBuf> {
    let target_triple = bundled_git_target_triple()?;
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    bundled_root_if_valid(
        manifest_dir
            .join(BUNDLED_GIT_RESOURCE_DIR)
            .join(target_triple),
    )
}

fn bundled_candidate_roots_for_exe_dir(exe_dir: &Path, target_triple: &str) -> Vec<PathBuf> {
    let package_name = env!("CARGO_PKG_NAME");
    vec![
        exe_dir.join(BUNDLED_GIT_RESOURCE_DIR).join(target_triple),
        exe_dir
            .join("resources")
            .join(BUNDLED_GIT_RESOURCE_DIR)
            .join(target_triple),
        exe_dir
            .join("../resources")
            .join(BUNDLED_GIT_RESOURCE_DIR)
            .join(target_triple),
        exe_dir
            .join("../Resources")
            .join(BUNDLED_GIT_RESOURCE_DIR)
            .join(target_triple),
        exe_dir
            .join("../lib")
            .join(package_name)
            .join(BUNDLED_GIT_RESOURCE_DIR)
            .join(target_triple),
    ]
}

fn resolve_current_exe_bundled_candidates() -> Vec<PathBuf> {
    let Some(target_triple) = bundled_git_target_triple() else {
        return Vec::new();
    };
    let Ok(current_exe) = env::current_exe() else {
        return Vec::new();
    };
    let Some(exe_dir) = current_exe.parent() else {
        return Vec::new();
    };

    bundled_candidate_roots_for_exe_dir(exe_dir, target_triple)
}

pub(crate) fn resolve_bundled_git_root() -> Option<PathBuf> {
    resolve_bundled_env_override()
        .or_else(resolve_dev_bundled_root)
        .or_else(|| {
            resolve_current_exe_bundled_candidates()
                .into_iter()
                .find_map(bundled_root_if_valid)
        })
}

fn resolve_path_git_binary() -> Option<PathBuf> {
    if cfg!(windows) {
        find_in_path("git.exe")
            .or_else(|| find_in_path("git"))
            .or_else(|| {
                [
                    "C:\\Program Files\\Git\\bin\\git.exe",
                    "C:\\Program Files\\Git\\cmd\\git.exe",
                    "C:\\Program Files (x86)\\Git\\bin\\git.exe",
                    "C:\\Program Files (x86)\\Git\\cmd\\git.exe",
                ]
                .iter()
                .find_map(|candidate| candidate_if_exists(PathBuf::from(candidate)))
            })
    } else {
        find_in_path("git").or_else(|| {
            [
                "/opt/homebrew/bin/git",
                "/usr/local/bin/git",
                "/usr/bin/git",
                "/opt/local/bin/git",
                "/run/current-system/sw/bin/git",
            ]
            .iter()
            .find_map(|candidate| candidate_if_exists(PathBuf::from(candidate)))
        })
    }
}

fn missing_git_error_message() -> String {
    if cfg!(windows) {
        "Git is unavailable. Reinstall Agent Monitor or ensure Git is installed on PATH."
            .to_string()
    } else {
        "Git is not installed. Install Git, then retry.".to_string()
    }
}

pub(crate) fn resolve_git_runtime() -> Result<ResolvedGitRuntime, String> {
    if let Some(custom_path) = resolve_custom_git_path()? {
        return Ok(ResolvedGitRuntime {
            program: custom_path.to_string_lossy().to_string(),
            source: GitRuntimeSource::Custom,
            bundled_root: None,
        });
    }

    if let Some(bundled_root) = resolve_bundled_git_root() {
        let program = windows_bundled_git_program(&bundled_root);
        return Ok(ResolvedGitRuntime {
            program: program.to_string_lossy().to_string(),
            source: GitRuntimeSource::Bundled,
            bundled_root: Some(bundled_root),
        });
    }

    if let Some(path_binary) = resolve_path_git_binary() {
        return Ok(ResolvedGitRuntime {
            program: path_binary.to_string_lossy().to_string(),
            source: GitRuntimeSource::Path,
            bundled_root: None,
        });
    }

    Err(missing_git_error_message())
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

pub(crate) fn format_git_command_error(stdout: &[u8], stderr: &[u8]) -> String {
    command_failure_detail(stdout, stderr, "Git command failed.")
}

pub(crate) fn format_git_spawn_error(error: &std::io::Error) -> String {
    if error.kind() == ErrorKind::NotFound {
        return missing_git_error_message();
    }
    format!("Failed to run git: {error}")
}

fn append_unique_path(paths: &mut Vec<PathBuf>, candidate: PathBuf) {
    if !candidate.as_os_str().is_empty() && !paths.contains(&candidate) {
        paths.push(candidate);
    }
}

fn inherited_path_entries() -> Vec<PathBuf> {
    env::var_os("PATH")
        .map(|value| env::split_paths(&value).collect())
        .unwrap_or_default()
}

fn git_home_override() -> Option<String> {
    if let Some(home) = env::var_os("HOME").filter(|value| !value.is_empty()) {
        return Some(home.to_string_lossy().to_string());
    }

    if cfg!(windows) {
        if let Some(user_profile) = env::var_os("USERPROFILE").filter(|value| !value.is_empty()) {
            return Some(user_profile.to_string_lossy().to_string());
        }

        let home_drive = env::var_os("HOMEDRIVE").filter(|value| !value.is_empty())?;
        let home_path = env::var_os("HOMEPATH").filter(|value| !value.is_empty())?;
        let mut home = PathBuf::from(home_drive);
        home.push(home_path);
        return Some(home.to_string_lossy().to_string());
    }

    None
}

fn bundled_git_exec_path(root: &Path) -> Option<String> {
    let path = root.join("mingw64").join("libexec").join("git-core");
    path.is_dir().then(|| path.to_string_lossy().to_string())
}

fn bundled_git_template_dir(root: &Path) -> Option<String> {
    let path = root
        .join("mingw64")
        .join("share")
        .join("git-core")
        .join("templates");
    path.is_dir().then(|| path.to_string_lossy().to_string())
}

fn git_path_env(runtime: &ResolvedGitRuntime) -> String {
    let mut paths = Vec::new();

    if let Some(root) = runtime.bundled_root.as_ref() {
        for candidate in [
            root.join("cmd"),
            root.join("mingw64").join("bin"),
            root.join("usr").join("bin"),
        ] {
            if candidate.is_dir() {
                append_unique_path(&mut paths, candidate);
            }
        }
    }

    for candidate in inherited_path_entries() {
        append_unique_path(&mut paths, candidate);
    }

    let defaults: &[&str] = if cfg!(windows) {
        &["C:\\Windows\\System32"]
    } else {
        &[
            "/usr/bin",
            "/bin",
            "/usr/local/bin",
            "/opt/homebrew/bin",
            "/opt/local/bin",
            "/run/current-system/sw/bin",
        ]
    };

    for candidate in defaults {
        append_unique_path(&mut paths, PathBuf::from(candidate));
    }

    let joined = env::join_paths(paths).unwrap_or_else(|_| OsString::new());
    joined.to_string_lossy().to_string()
}

pub(crate) fn git_runtime_env(runtime: &ResolvedGitRuntime) -> Vec<(String, String)> {
    let mut envs = vec![("PATH".to_string(), git_path_env(runtime))];

    if let Some(home) = git_home_override() {
        envs.push(("HOME".to_string(), home));
    }

    if let Some(root) = runtime.bundled_root.as_ref() {
        if let Some(exec_path) = bundled_git_exec_path(root) {
            envs.push(("GIT_EXEC_PATH".to_string(), exec_path));
        }
        if let Some(template_dir) = bundled_git_template_dir(root) {
            envs.push(("GIT_TEMPLATE_DIR".to_string(), template_dir));
        }
    }

    envs
}

#[cfg(test)]
mod tests {
    use super::{
        bundled_candidate_roots_for_exe_dir, bundled_git_target_triple_for, format_git_command_error,
        format_git_spawn_error, git_runtime_env, resolve_git_runtime, GitRuntimeSource,
        ResolvedGitRuntime, BUNDLED_GIT_RESOURCE_DIR,
    };
    use std::env;
    use std::fs;
    use std::io::ErrorKind;
    use std::path::{Path, PathBuf};
    use std::sync::Mutex;
    use std::time::{SystemTime, UNIX_EPOCH};

    static ENV_LOCK: Mutex<()> = Mutex::new(());

    fn create_temp_dir(name: &str) -> PathBuf {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock")
            .as_nanos();
        let dir = env::temp_dir().join(format!("codex-monitor-git-runtime-test-{name}-{unique}"));
        fs::create_dir_all(&dir).expect("create temp dir");
        dir
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
    fn custom_runtime_env_var_beats_other_sources() {
        let temp_dir = create_temp_dir("custom");
        let custom_path = temp_dir.join(if cfg!(windows) { "git.exe" } else { "git" });
        fs::write(&custom_path, b"stub").expect("write custom binary");

        let resolved = with_env_vars(
            &[("CODEX_MONITOR_GIT_PATH", Some(custom_path.as_os_str()))],
            || resolve_git_runtime().expect("resolve git runtime"),
        );

        assert_eq!(resolved.program, custom_path.to_string_lossy().to_string());
        assert_eq!(resolved.source, GitRuntimeSource::Custom);
    }

    #[test]
    fn invalid_custom_runtime_path_fails_fast() {
        let temp_dir = create_temp_dir("invalid-custom");
        let missing_path = temp_dir.join("missing-git");

        let error = with_env_vars(
            &[("CODEX_MONITOR_GIT_PATH", Some(missing_path.as_os_str()))],
            resolve_git_runtime,
        )
        .expect_err("invalid custom path should fail");

        assert!(error.contains("Configured Git executable is unavailable"));
    }

    #[test]
    fn bundled_windows_env_includes_mingit_dirs() {
        let root = create_temp_dir("bundled-root");
        for relative in [
            "cmd",
            "mingw64/bin",
            "mingw64/libexec/git-core",
            "mingw64/share/git-core/templates",
            "usr/bin",
        ] {
            fs::create_dir_all(root.join(relative)).expect("create runtime directory");
        }

        let runtime = ResolvedGitRuntime {
            program: root.join("cmd/git.exe").to_string_lossy().to_string(),
            source: GitRuntimeSource::Bundled,
            bundled_root: Some(root.clone()),
        };
        let envs = git_runtime_env(&runtime);
        let path_env = envs
            .iter()
            .find(|(key, _)| key == "PATH")
            .map(|(_, value)| value.clone())
            .expect("path env");

        assert!(path_env.contains(&root.join("cmd").to_string_lossy().to_string()));
        assert!(path_env.contains(&root.join("mingw64/bin").to_string_lossy().to_string()));
        assert!(path_env.contains(&root.join("usr/bin").to_string_lossy().to_string()));
        assert!(
            envs.iter().any(|(key, value)| {
                key == "GIT_EXEC_PATH"
                    && value == &root.join("mingw64/libexec/git-core").to_string_lossy().to_string()
            })
        );
        assert!(
            envs.iter().any(|(key, value)| {
                key == "GIT_TEMPLATE_DIR"
                    && value
                        == &root
                            .join("mingw64/share/git-core/templates")
                            .to_string_lossy()
                            .to_string()
            })
        );
    }

    #[test]
    fn format_helpers_keep_actionable_messages() {
        assert_eq!(
            format_git_command_error(b"", b"fatal: not a git repository"),
            "fatal: not a git repository"
        );

        let spawn_error = std::io::Error::new(ErrorKind::NotFound, "missing");
        assert!(
            format_git_spawn_error(&spawn_error).contains("Git"),
            "spawn error should stay actionable"
        );
    }

    #[test]
    fn windows_targets_use_msvc_triples() {
        assert_eq!(
            bundled_git_target_triple_for("windows", "x86_64"),
            Some("x86_64-pc-windows-msvc")
        );
        assert_eq!(
            bundled_git_target_triple_for("windows", "aarch64"),
            Some("aarch64-pc-windows-msvc")
        );
        assert_eq!(bundled_git_target_triple_for("macos", "aarch64"), None);
    }

    #[test]
    fn packaged_candidate_roots_cover_standard_resource_locations() {
        let exe_dir = Path::new("/tmp/codex-monitor");
        let candidates = bundled_candidate_roots_for_exe_dir(exe_dir, "x86_64-pc-windows-msvc");
        assert!(
            candidates.iter().any(|path| {
                path.ends_with(Path::new(BUNDLED_GIT_RESOURCE_DIR).join("x86_64-pc-windows-msvc"))
            })
        );
    }
}
