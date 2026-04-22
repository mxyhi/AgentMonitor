use std::env;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum CodexRuntimeSource {
    Custom,
    Bundled,
    Path,
}

impl CodexRuntimeSource {
    pub(crate) fn as_str(self) -> &'static str {
        match self {
            Self::Custom => "custom",
            Self::Bundled => "bundled",
            Self::Path => "path",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct ResolvedCodexRuntime {
    pub(crate) program: String,
    pub(crate) source: CodexRuntimeSource,
}

pub(crate) const BUNDLED_CODEX_VERSION: &str = "0.122.0";
pub(crate) const BUNDLED_CODEX_SIDECAR_NAME: &str = "codex-bundled";

pub(crate) fn bundled_codex_version() -> &'static str {
    BUNDLED_CODEX_VERSION
}

fn bundled_codex_target_triple_for(target_os: &str, target_arch: &str) -> &'static str {
    match (target_os, target_arch) {
        ("macos", "aarch64") => "aarch64-apple-darwin",
        ("macos", "x86_64") => "x86_64-apple-darwin",
        ("linux", "x86_64") => "x86_64-unknown-linux-gnu",
        ("linux", "aarch64") => "aarch64-unknown-linux-gnu",
        ("windows", "x86_64") => "x86_64-pc-windows-msvc",
        ("windows", "aarch64") => "aarch64-pc-windows-msvc",
        _ => panic!("Unsupported bundled Codex target: {target_os}/{target_arch}"),
    }
}

pub(crate) fn bundled_codex_target_triple() -> &'static str {
    bundled_codex_target_triple_for(env::consts::OS, env::consts::ARCH)
}

pub(crate) fn bundled_codex_file_name() -> String {
    if cfg!(target_os = "windows") {
        format!(
            "{}-{}.exe",
            BUNDLED_CODEX_SIDECAR_NAME,
            bundled_codex_target_triple()
        )
    } else {
        format!(
            "{}-{}",
            BUNDLED_CODEX_SIDECAR_NAME,
            bundled_codex_target_triple()
        )
    }
}

fn bundled_codex_packaged_file_names() -> Vec<String> {
    let mut names = vec![bundled_codex_file_name()];
    let bare_name = if cfg!(target_os = "windows") {
        format!("{BUNDLED_CODEX_SIDECAR_NAME}.exe")
    } else {
        BUNDLED_CODEX_SIDECAR_NAME.to_string()
    };
    if !names.iter().any(|name| name == &bare_name) {
        names.push(bare_name);
    }
    names
}

fn candidate_if_exists(path: PathBuf) -> Option<PathBuf> {
    path.is_file().then_some(path)
}

fn resolve_env_override() -> Option<PathBuf> {
    let override_path = env::var_os("CODEX_MONITOR_BUNDLED_CODEX_PATH")?;
    let path = PathBuf::from(override_path);
    candidate_if_exists(path)
}

fn resolve_dev_bundled_path() -> Option<PathBuf> {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    candidate_if_exists(
        manifest_dir
            .join("binaries")
            .join(bundled_codex_file_name()),
    )
}

fn bundled_candidate_paths_for_exe_dir(exe_dir: &Path) -> Vec<PathBuf> {
    let package_name = env!("CARGO_PKG_NAME");
    let mut candidates = Vec::new();

    for file_name in bundled_codex_packaged_file_names() {
        // Packaged app / daemon layouts differ by platform and bundle target.
        // Keep a small set of deterministic candidates instead of hard-coding one path.
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

pub(crate) fn resolve_bundled_codex_path() -> Option<PathBuf> {
    resolve_env_override()
        .or_else(resolve_dev_bundled_path)
        .or_else(|| {
            resolve_current_exe_bundled_candidates()
                .into_iter()
                .find(|candidate| candidate.is_file())
        })
}

pub(crate) fn resolve_codex_runtime(requested_bin: Option<&str>) -> ResolvedCodexRuntime {
    if let Some(custom_bin) = requested_bin
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
    {
        return ResolvedCodexRuntime {
            program: custom_bin,
            source: CodexRuntimeSource::Custom,
        };
    }

    if let Some(bundled_path) = resolve_bundled_codex_path() {
        return ResolvedCodexRuntime {
            program: bundled_path.to_string_lossy().to_string(),
            source: CodexRuntimeSource::Bundled,
        };
    }

    ResolvedCodexRuntime {
        program: "codex".to_string(),
        source: CodexRuntimeSource::Path,
    }
}

pub(crate) fn codex_runtime_requires_node(source: CodexRuntimeSource) -> bool {
    !matches!(source, CodexRuntimeSource::Bundled)
}

pub(crate) fn codex_runtime_parent_dir(program: &str) -> Option<PathBuf> {
    Path::new(program)
        .parent()
        .filter(|parent| !parent.as_os_str().is_empty())
        .map(Path::to_path_buf)
}

#[cfg(test)]
mod tests {
    use super::{
        bundled_candidate_paths_for_exe_dir, bundled_codex_file_name,
        bundled_codex_target_triple_for, codex_runtime_requires_node, resolve_bundled_codex_path,
        resolve_codex_runtime, CodexRuntimeSource, BUNDLED_CODEX_SIDECAR_NAME,
    };
    use std::fs;
    use std::sync::Mutex;
    use std::time::{SystemTime, UNIX_EPOCH};

    static ENV_LOCK: Mutex<()> = Mutex::new(());

    fn with_env_override<T>(path: &std::path::Path, run: impl FnOnce() -> T) -> T {
        let _guard = ENV_LOCK.lock().expect("lock env");
        std::env::set_var("CODEX_MONITOR_BUNDLED_CODEX_PATH", path);
        let result = run();
        std::env::remove_var("CODEX_MONITOR_BUNDLED_CODEX_PATH");
        result
    }

    fn create_temp_file(name: &str) -> std::path::PathBuf {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock")
            .as_nanos();
        let dir = std::env::temp_dir().join(format!("codex-monitor-runtime-test-{unique}"));
        fs::create_dir_all(&dir).expect("create temp dir");
        let path = dir.join(name);
        fs::write(&path, b"stub").expect("write temp file");
        path
    }

    #[test]
    fn bundled_runtime_env_override_wins_when_present() {
        let temp_path = create_temp_file(&bundled_codex_file_name());
        let resolved = with_env_override(&temp_path, resolve_bundled_codex_path);
        assert_eq!(resolved, Some(temp_path));
    }

    #[test]
    fn explicit_runtime_bin_beats_bundled_runtime() {
        let temp_path = create_temp_file(&bundled_codex_file_name());
        let resolved = with_env_override(&temp_path, || {
            resolve_codex_runtime(Some("/tmp/custom-codex"))
        });
        assert_eq!(resolved.program, "/tmp/custom-codex");
        assert_eq!(resolved.source, CodexRuntimeSource::Custom);
    }

    #[test]
    fn bundled_runtime_beats_path_lookup() {
        let temp_path = create_temp_file(&bundled_codex_file_name());
        let resolved = with_env_override(&temp_path, || resolve_codex_runtime(None));
        assert_eq!(resolved.program, temp_path.to_string_lossy().to_string());
        assert_eq!(resolved.source, CodexRuntimeSource::Bundled);
    }

    #[test]
    fn bundled_runtime_does_not_require_node_on_path() {
        assert!(!codex_runtime_requires_node(CodexRuntimeSource::Bundled));
        assert!(codex_runtime_requires_node(CodexRuntimeSource::Path));
        assert!(codex_runtime_requires_node(CodexRuntimeSource::Custom));
    }

    #[test]
    fn linux_targets_use_gnu_triples() {
        assert_eq!(
            bundled_codex_target_triple_for("linux", "x86_64"),
            "x86_64-unknown-linux-gnu"
        );
        assert_eq!(
            bundled_codex_target_triple_for("linux", "aarch64"),
            "aarch64-unknown-linux-gnu"
        );
    }

    #[test]
    fn packaged_runtime_candidates_include_bare_sidecar_next_to_app_binary() {
        let exe_dir = std::path::Path::new("/Applications/Agent Monitor.app/Contents/MacOS");
        let candidates = bundled_candidate_paths_for_exe_dir(exe_dir);
        let bare_sidecar = if cfg!(target_os = "windows") {
            exe_dir.join(format!("{BUNDLED_CODEX_SIDECAR_NAME}.exe"))
        } else {
            exe_dir.join(BUNDLED_CODEX_SIDECAR_NAME)
        };
        assert!(candidates.iter().any(|path| path == &bare_sidecar));
    }
}
