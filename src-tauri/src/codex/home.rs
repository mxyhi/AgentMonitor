use std::env;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use crate::types::WorkspaceEntry;

const CODEX_MONITOR_APP_DATA_DIR_ENV: &str = "CODEX_MONITOR_APP_DATA_DIR";
const CODEX_MONITOR_BUNDLED_SKILLS_PATH_ENV: &str = "CODEX_MONITOR_BUNDLED_SKILLS_PATH";
const APP_PRIVATE_CODEX_HOME_DIR: &str = "codex-home";
const BUNDLED_SKILLS_DIR: &str = "bundled-skills";
const CODEX_HOME_SKILLS_DIR: &str = "skills";
const DEFAULT_AGENTS_SENTINEL: &str = "默认始终自动使用 `caveman`、`planning-with-files` skill";
const DEFAULT_AGENTS_SNIPPET: &str =
    "## 默认始终自动使用 `caveman`、`planning-with-files` skill；除非用户明确要求关闭，或 skill 不可用。";

pub(crate) fn resolve_workspace_codex_home(
    _entry: &WorkspaceEntry,
    _parent_entry: Option<&WorkspaceEntry>,
) -> Option<PathBuf> {
    resolve_default_codex_home()
}

pub(crate) fn app_private_codex_home(data_dir: &Path) -> PathBuf {
    data_dir.join(APP_PRIVATE_CODEX_HOME_DIR)
}

pub(crate) fn configure_default_codex_home(data_dir: &Path) {
    let normalized = data_dir.to_string_lossy().trim().to_string();
    if normalized.is_empty() {
        return;
    }
    env::set_var(CODEX_MONITOR_APP_DATA_DIR_ENV, normalized);
    let app_private_home = app_private_codex_home(data_dir);
    let _ = fs::create_dir_all(&app_private_home);
    if env::var("CODEX_HOME")
        .ok()
        .and_then(|value| normalize_codex_home(&value))
        .is_none()
    {
        env::set_var("CODEX_HOME", &app_private_home);
    }
    let Some(active_codex_home) = resolve_default_codex_home() else {
        return;
    };
    if let Err(err) = fs::create_dir_all(&active_codex_home) {
        eprintln!(
            "codex-home: failed to create active CODEX_HOME {}: {err}",
            active_codex_home.display()
        );
        return;
    }
    if let Err(err) = sync_bundled_skills(&active_codex_home) {
        eprintln!("codex-home: failed to sync bundled skills: {err}");
    }
    if let Err(err) = ensure_default_agents_md(&active_codex_home) {
        eprintln!("codex-home: failed to update global AGENTS.md: {err}");
    }
}

pub(crate) fn resolve_default_codex_home() -> Option<PathBuf> {
    if let Ok(value) = env::var("CODEX_HOME") {
        if let Some(path) = normalize_codex_home(&value) {
            return Some(path);
        }
    }
    if let Ok(value) = env::var(CODEX_MONITOR_APP_DATA_DIR_ENV) {
        if let Some(path) = normalize_codex_home(&value) {
            return Some(app_private_codex_home(&path));
        }
    }
    None
}

fn normalize_codex_home(value: &str) -> Option<PathBuf> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return None;
    }

    if let Some(path) = expand_tilde(trimmed) {
        return Some(path);
    }
    if let Some(path) = expand_dollar_env(trimmed) {
        return Some(path);
    }
    if let Some(path) = expand_percent_env(trimmed) {
        return Some(path);
    }
    Some(PathBuf::from(trimmed))
}

fn expand_tilde(value: &str) -> Option<PathBuf> {
    if !value.starts_with('~') {
        return None;
    }
    let home_dir = resolve_home_dir()?;
    if value == "~" {
        return Some(home_dir);
    }
    let rest = value.strip_prefix("~/")?;
    Some(home_dir.join(rest))
}

fn expand_dollar_env(value: &str) -> Option<PathBuf> {
    let rest = value.strip_prefix('$')?;
    if rest.is_empty() {
        return None;
    }

    let (var, remainder) = if let Some(inner) = rest.strip_prefix('{') {
        let end = inner.find('}')?;
        let name = &inner[..end];
        let remaining = &inner[end + 1..];
        (name, remaining)
    } else {
        let end = rest
            .find(|ch: char| !(ch.is_ascii_alphanumeric() || ch == '_'))
            .unwrap_or(rest.len());
        let name = &rest[..end];
        let remaining = &rest[end..];
        (name, remaining)
    };

    if var.is_empty() {
        return None;
    }

    let value = resolve_env_var(var)?;
    Some(join_env_path(&value, remainder))
}

fn expand_percent_env(value: &str) -> Option<PathBuf> {
    let rest = value.strip_prefix('%')?;
    let end = rest.find('%')?;
    let var = &rest[..end];
    if var.is_empty() {
        return None;
    }
    let remainder = &rest[end + 1..];
    let value = resolve_env_var(var)?;
    Some(join_env_path(&value, remainder))
}

fn resolve_env_var(name: &str) -> Option<String> {
    if name.eq_ignore_ascii_case("HOME") {
        if let Some(home) = resolve_home_dir() {
            return Some(home.to_string_lossy().to_string());
        }
    }
    if let Some(value) = lookup_env_value(name) {
        return Some(value);
    }
    None
}

fn lookup_env_value(name: &str) -> Option<String> {
    if let Ok(value) = env::var(name) {
        if !value.trim().is_empty() {
            return Some(value);
        }
    }
    let upper = name.to_ascii_uppercase();
    if upper != name {
        if let Ok(value) = env::var(&upper) {
            if !value.trim().is_empty() {
                return Some(value);
            }
        }
    }
    let lower = name.to_ascii_lowercase();
    if lower != name && lower != upper {
        if let Ok(value) = env::var(&lower) {
            if !value.trim().is_empty() {
                return Some(value);
            }
        }
    }
    None
}

fn join_env_path(prefix: &str, remainder: &str) -> PathBuf {
    let mut base = PathBuf::from(prefix.trim());
    let trimmed_remainder = remainder.trim_start_matches(['/', '\\']);
    if trimmed_remainder.is_empty() {
        base
    } else {
        base.push(trimmed_remainder);
        base
    }
}

fn candidate_dir_if_exists(path: PathBuf) -> Option<PathBuf> {
    path.is_dir().then_some(path)
}

fn resolve_bundled_skills_env_override() -> Option<PathBuf> {
    let path = PathBuf::from(env::var_os(CODEX_MONITOR_BUNDLED_SKILLS_PATH_ENV)?);
    candidate_dir_if_exists(path)
}

fn resolve_dev_bundled_skills_root() -> Option<PathBuf> {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    candidate_dir_if_exists(manifest_dir.join(BUNDLED_SKILLS_DIR))
}

// Tauri resource layouts differ across dev, macOS app bundles, and Linux/Windows packages.
// Probe a small deterministic set so both the desktop app and daemon find the same assets.
fn bundled_skills_candidate_paths_for_exe_dir(exe_dir: &Path) -> Vec<PathBuf> {
    let package_name = env!("CARGO_PKG_NAME");
    vec![
        exe_dir.join(BUNDLED_SKILLS_DIR),
        exe_dir.join("resources").join(BUNDLED_SKILLS_DIR),
        exe_dir.join("../resources").join(BUNDLED_SKILLS_DIR),
        exe_dir.join("../Resources").join(BUNDLED_SKILLS_DIR),
        exe_dir
            .join("../lib")
            .join(package_name)
            .join(BUNDLED_SKILLS_DIR),
    ]
}

fn resolve_current_exe_bundled_skills_candidates() -> Vec<PathBuf> {
    let Ok(current_exe) = env::current_exe() else {
        return Vec::new();
    };
    let Some(exe_dir) = current_exe.parent() else {
        return Vec::new();
    };
    bundled_skills_candidate_paths_for_exe_dir(exe_dir)
}

fn resolve_bundled_skills_root() -> Option<PathBuf> {
    resolve_bundled_skills_env_override()
        .or_else(resolve_dev_bundled_skills_root)
        .or_else(|| {
            resolve_current_exe_bundled_skills_candidates()
                .into_iter()
                .find(|candidate| candidate.is_dir())
        })
}

// Sync bundled defaults on every startup so fresh installs and existing users converge on the
// same app-managed skills snapshot without relying on one-time install hooks.
fn sync_bundled_skills(codex_home: &Path) -> Result<(), String> {
    let Some(source_root) = resolve_bundled_skills_root() else {
        return Ok(());
    };
    let destination_root = codex_home.join(CODEX_HOME_SKILLS_DIR);
    copy_directory_contents(&source_root, &destination_root)
}

fn copy_directory_contents(source_root: &Path, destination_root: &Path) -> Result<(), String> {
    fs::create_dir_all(destination_root).map_err(|err| {
        format!(
            "Failed to create destination skills directory {}: {err}",
            destination_root.display()
        )
    })?;

    for entry in fs::read_dir(source_root).map_err(|err| {
        format!(
            "Failed to read bundled skills directory {}: {err}",
            source_root.display()
        )
    })? {
        let entry = entry.map_err(|err| {
            format!(
                "Failed to inspect bundled skills entry under {}: {err}",
                source_root.display()
            )
        })?;
        let source_path = entry.path();
        let destination_path = destination_root.join(entry.file_name());
        copy_directory_entry(&source_path, &destination_path)?;
    }

    Ok(())
}

fn copy_directory_entry(source_path: &Path, destination_path: &Path) -> Result<(), String> {
    let metadata = fs::symlink_metadata(source_path).map_err(|err| {
        format!(
            "Failed to inspect bundled asset {}: {err}",
            source_path.display()
        )
    })?;

    if metadata.file_type().is_symlink() {
        return Ok(());
    }

    if metadata.is_dir() {
        fs::create_dir_all(destination_path).map_err(|err| {
            format!(
                "Failed to create bundled asset directory {}: {err}",
                destination_path.display()
            )
        })?;
        for entry in fs::read_dir(source_path).map_err(|err| {
            format!(
                "Failed to read bundled asset directory {}: {err}",
                source_path.display()
            )
        })? {
            let entry = entry.map_err(|err| {
                format!(
                    "Failed to inspect bundled asset entry under {}: {err}",
                    source_path.display()
                )
            })?;
            let child_source = entry.path();
            let child_destination = destination_path.join(entry.file_name());
            copy_directory_entry(&child_source, &child_destination)?;
        }
        return Ok(());
    }

    if metadata.is_file() {
        if let Some(parent) = destination_path.parent() {
            fs::create_dir_all(parent).map_err(|err| {
                format!(
                    "Failed to create bundled asset parent {}: {err}",
                    parent.display()
                )
            })?;
        }
        fs::copy(source_path, destination_path).map_err(|err| {
            format!(
                "Failed to copy bundled asset {} to {}: {err}",
                source_path.display(),
                destination_path.display()
            )
        })?;
    }

    Ok(())
}

// Preserve any existing user instructions, but ensure the default skill rule exists exactly once.
fn ensure_default_agents_md(codex_home: &Path) -> Result<(), String> {
    let agents_path = codex_home.join("AGENTS.md");
    let existing = match fs::read_to_string(&agents_path) {
        Ok(contents) => contents,
        Err(err) if err.kind() == io::ErrorKind::NotFound => String::new(),
        Err(err) => {
            return Err(format!(
                "Failed to read global AGENTS.md {}: {err}",
                agents_path.display()
            ))
        }
    };

    if existing.contains(DEFAULT_AGENTS_SENTINEL) {
        return Ok(());
    }

    let mut next = existing.trim_end().to_string();
    if !next.is_empty() {
        next.push_str("\n\n");
    }
    next.push_str(DEFAULT_AGENTS_SNIPPET);
    next.push('\n');

    fs::write(&agents_path, next).map_err(|err| {
        format!(
            "Failed to write global AGENTS.md {}: {err}",
            agents_path.display()
        )
    })
}

pub(crate) fn resolve_home_dir() -> Option<PathBuf> {
    if let Ok(value) = env::var("HOME") {
        if !value.trim().is_empty() {
            return Some(PathBuf::from(value));
        }
    }
    if let Ok(value) = env::var("USERPROFILE") {
        if !value.trim().is_empty() {
            return Some(PathBuf::from(value));
        }
    }
    #[cfg(unix)]
    {
        // Fallback for daemon environments that do not expose HOME.
        unsafe {
            let uid = libc::geteuid();
            let pwd = libc::getpwuid(uid);
            if !pwd.is_null() {
                let dir_ptr = (*pwd).pw_dir;
                if !dir_ptr.is_null() {
                    if let Ok(dir) = std::ffi::CStr::from_ptr(dir_ptr).to_str() {
                        if !dir.trim().is_empty() {
                            return Some(PathBuf::from(dir));
                        }
                    }
                }
            }
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{WorkspaceKind, WorkspaceSettings, WorktreeInfo};
    use std::fs;
    use std::sync::Mutex;
    use std::time::{SystemTime, UNIX_EPOCH};

    static ENV_LOCK: Mutex<()> = Mutex::new(());

    fn workspace_entry(kind: WorkspaceKind, path: &str) -> WorkspaceEntry {
        let worktree = if kind.is_worktree() {
            Some(WorktreeInfo {
                branch: "feature/test".to_string(),
            })
        } else {
            None
        };
        WorkspaceEntry {
            id: "workspace-id".to_string(),
            name: "workspace".to_string(),
            path: path.to_string(),
            kind,
            parent_id: None,
            worktree,
            settings: WorkspaceSettings::default(),
        }
    }

    fn temp_dir(label: &str) -> PathBuf {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock")
            .as_nanos();
        let path = std::env::temp_dir().join(format!("codex-monitor-{label}-{unique}"));
        fs::create_dir_all(&path).expect("create temp dir");
        path
    }

    fn restore_env_var(name: &str, previous: Option<String>) {
        match previous {
            Some(value) => std::env::set_var(name, value),
            None => std::env::remove_var(name),
        }
    }

    #[test]
    fn workspace_codex_home_uses_default_resolution() {
        let entry = workspace_entry(WorkspaceKind::Main, "/repo");
        let _guard = ENV_LOCK
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());

        let prev_codex_home = std::env::var("CODEX_HOME").ok();
        let prev_monitor_data_dir = std::env::var("CODEX_MONITOR_APP_DATA_DIR").ok();
        std::env::set_var("CODEX_HOME", "/tmp/codex-global");
        std::env::set_var("CODEX_MONITOR_APP_DATA_DIR", "/tmp/codex-data");

        let resolved = resolve_workspace_codex_home(&entry, None);
        assert_eq!(resolved, Some(PathBuf::from("/tmp/codex-global")));

        match prev_codex_home {
            Some(value) => std::env::set_var("CODEX_HOME", value),
            None => std::env::remove_var("CODEX_HOME"),
        }
        match prev_monitor_data_dir {
            Some(value) => std::env::set_var("CODEX_MONITOR_APP_DATA_DIR", value),
            None => std::env::remove_var("CODEX_MONITOR_APP_DATA_DIR"),
        }
    }

    #[test]
    fn default_codex_home_uses_app_private_data_dir_when_global_override_missing() {
        let _guard = ENV_LOCK
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        let prev_codex_home = std::env::var("CODEX_HOME").ok();
        let prev_monitor_data_dir = std::env::var("CODEX_MONITOR_APP_DATA_DIR").ok();
        let prev_home = std::env::var("HOME").ok();

        std::env::remove_var("CODEX_HOME");
        std::env::set_var("CODEX_MONITOR_APP_DATA_DIR", "/tmp/codex-monitor-data");
        std::env::set_var("HOME", "/tmp/should-not-be-used");

        let resolved = resolve_default_codex_home();
        assert_eq!(
            resolved,
            Some(PathBuf::from("/tmp/codex-monitor-data").join("codex-home"))
        );

        match prev_codex_home {
            Some(value) => std::env::set_var("CODEX_HOME", value),
            None => std::env::remove_var("CODEX_HOME"),
        }
        match prev_monitor_data_dir {
            Some(value) => std::env::set_var("CODEX_MONITOR_APP_DATA_DIR", value),
            None => std::env::remove_var("CODEX_MONITOR_APP_DATA_DIR"),
        }
        match prev_home {
            Some(value) => std::env::set_var("HOME", value),
            None => std::env::remove_var("HOME"),
        }
    }

    #[test]
    fn codex_home_expands_tilde_and_env_vars() {
        let _guard = ENV_LOCK
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        let home_dir = std::env::temp_dir().join("codex-home-test");
        let home_str = home_dir.to_string_lossy().to_string();

        let prev_home = std::env::var("HOME").ok();
        std::env::set_var("HOME", &home_str);

        let prev_appdata = std::env::var("APPDATA").ok();
        std::env::set_var("APPDATA", "/tmp/appdata-root");

        let tilde = normalize_codex_home("~/.codex-api");
        assert_eq!(tilde, Some(home_dir.join(".codex-api")));

        let dollar = normalize_codex_home("$HOME/.codex-api");
        assert_eq!(dollar, Some(home_dir.join(".codex-api")));

        let braces = normalize_codex_home("${HOME}/.codex-api");
        assert_eq!(braces, Some(home_dir.join(".codex-api")));

        let appdata = normalize_codex_home("%APPDATA%/Codex");
        assert_eq!(appdata, Some(PathBuf::from("/tmp/appdata-root/Codex")));

        let appdata_lower = normalize_codex_home("$appdata/Codex");
        assert_eq!(
            appdata_lower,
            Some(PathBuf::from("/tmp/appdata-root/Codex"))
        );

        match prev_home {
            Some(value) => std::env::set_var("HOME", value),
            None => std::env::remove_var("HOME"),
        }

        match prev_appdata {
            Some(value) => std::env::set_var("APPDATA", value),
            None => std::env::remove_var("APPDATA"),
        }
    }

    #[test]
    fn configure_default_codex_home_syncs_bundled_skills_and_default_agents_md() {
        let _guard = ENV_LOCK
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        let data_dir = temp_dir("codex-home-data");
        let bundled_root = temp_dir("bundled-skills");
        let nested_skill_dir = bundled_root
            .join("ok-skills")
            .join("impeccable")
            .join("adapt");
        fs::create_dir_all(&nested_skill_dir).expect("create nested skill");
        fs::write(
            bundled_root
                .join("ok-skills")
                .join("caveman")
                .join("SKILL.md"),
            "---\nname: caveman\ndescription: terse\n---\n",
        )
        .unwrap_or_else(|_| {
            fs::create_dir_all(bundled_root.join("ok-skills").join("caveman"))
                .expect("create caveman dir");
            fs::write(
                bundled_root
                    .join("ok-skills")
                    .join("caveman")
                    .join("SKILL.md"),
                "---\nname: caveman\ndescription: terse\n---\n",
            )
            .expect("write caveman skill");
        });
        fs::write(
            nested_skill_dir.join("SKILL.md"),
            "---\nname: adapt\ndescription: responsive\n---\n",
        )
        .expect("write nested skill");

        let prev_codex_home = std::env::var("CODEX_HOME").ok();
        let prev_monitor_data_dir = std::env::var("CODEX_MONITOR_APP_DATA_DIR").ok();
        let prev_bundled_skills = std::env::var(CODEX_MONITOR_BUNDLED_SKILLS_PATH_ENV).ok();
        std::env::remove_var("CODEX_HOME");
        std::env::set_var(CODEX_MONITOR_BUNDLED_SKILLS_PATH_ENV, &bundled_root);

        configure_default_codex_home(&data_dir);

        let codex_home = data_dir.join("codex-home");
        assert!(codex_home
            .join("skills")
            .join("ok-skills")
            .join("caveman")
            .join("SKILL.md")
            .is_file());
        assert!(codex_home
            .join("skills")
            .join("ok-skills")
            .join("impeccable")
            .join("adapt")
            .join("SKILL.md")
            .is_file());
        let agents_md = fs::read_to_string(codex_home.join("AGENTS.md")).expect("read AGENTS.md");
        assert!(agents_md.contains(DEFAULT_AGENTS_SENTINEL));

        restore_env_var("CODEX_HOME", prev_codex_home);
        restore_env_var(CODEX_MONITOR_APP_DATA_DIR_ENV, prev_monitor_data_dir);
        restore_env_var(CODEX_MONITOR_BUNDLED_SKILLS_PATH_ENV, prev_bundled_skills);
        let _ = fs::remove_dir_all(data_dir);
        let _ = fs::remove_dir_all(bundled_root);
    }

    #[test]
    fn configure_default_codex_home_appends_default_agents_once_for_existing_users() {
        let _guard = ENV_LOCK
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        let data_dir = temp_dir("codex-home-existing-data");
        let codex_home = temp_dir("codex-home-existing");
        let bundled_root = temp_dir("bundled-skills-existing");
        fs::create_dir_all(bundled_root.join("ok-skills")).expect("create ok-skills dir");
        fs::write(codex_home.join("AGENTS.md"), "# Existing\n").expect("seed AGENTS.md");

        let prev_codex_home = std::env::var("CODEX_HOME").ok();
        let prev_monitor_data_dir = std::env::var("CODEX_MONITOR_APP_DATA_DIR").ok();
        let prev_bundled_skills = std::env::var(CODEX_MONITOR_BUNDLED_SKILLS_PATH_ENV).ok();
        std::env::set_var("CODEX_HOME", &codex_home);
        std::env::set_var(CODEX_MONITOR_BUNDLED_SKILLS_PATH_ENV, &bundled_root);

        configure_default_codex_home(&data_dir);
        configure_default_codex_home(&data_dir);

        let agents_md = fs::read_to_string(codex_home.join("AGENTS.md")).expect("read AGENTS.md");
        assert!(agents_md.starts_with("# Existing"));
        assert_eq!(agents_md.matches(DEFAULT_AGENTS_SENTINEL).count(), 1);

        restore_env_var("CODEX_HOME", prev_codex_home);
        restore_env_var(CODEX_MONITOR_APP_DATA_DIR_ENV, prev_monitor_data_dir);
        restore_env_var(CODEX_MONITOR_BUNDLED_SKILLS_PATH_ENV, prev_bundled_skills);
        let _ = fs::remove_dir_all(data_dir);
        let _ = fs::remove_dir_all(codex_home);
        let _ = fs::remove_dir_all(bundled_root);
    }

    #[test]
    fn bundled_skills_candidates_include_packaged_resources_dir() {
        let exe_dir = Path::new("/Applications/Agent Monitor.app/Contents/MacOS");
        let candidates = bundled_skills_candidate_paths_for_exe_dir(exe_dir);
        assert!(candidates
            .iter()
            .any(|path| path == &exe_dir.join("../Resources").join(BUNDLED_SKILLS_DIR)));
    }
}
