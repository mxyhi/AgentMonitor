use std::fs;
use std::path::PathBuf;

use serde_json::Value;

#[test]
fn macos_private_api_feature_matches_config() {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let config_path = manifest_dir.join("tauri.conf.json");
    let config_contents = fs::read_to_string(&config_path)
        .unwrap_or_else(|error| panic!("Failed to read {config_path:?}: {error}"));
    let config: Value = serde_json::from_str(&config_contents)
        .unwrap_or_else(|error| panic!("Failed to parse tauri.conf.json: {error}"));
    let macos_private_api = config
        .get("app")
        .and_then(|app| app.get("macOSPrivateApi"))
        .and_then(|value| value.as_bool())
        .unwrap_or(false);

    if macos_private_api {
        let cargo_path = manifest_dir.join("Cargo.toml");
        let cargo_contents = fs::read_to_string(&cargo_path)
            .unwrap_or_else(|error| panic!("Failed to read {cargo_path:?}: {error}"));
        let mut in_dependencies = false;
        let mut has_feature = false;

        for line in cargo_contents.lines() {
            let trimmed = line.trim();
            if trimmed.starts_with('[') {
                in_dependencies = trimmed == "[dependencies]";
                continue;
            }
            if !in_dependencies {
                continue;
            }
            if trimmed.starts_with("tauri") && trimmed.contains("macos-private-api") {
                has_feature = true;
                break;
            }
        }

        assert!(
            has_feature,
            "Cargo.toml [dependencies] must enable macos-private-api when app.macOSPrivateApi is true"
        );
    }
}

#[test]
fn bundled_codex_sidecar_is_declared_in_desktop_config() {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let config_path = manifest_dir.join("tauri.conf.json");
    let config_contents = fs::read_to_string(&config_path)
        .unwrap_or_else(|error| panic!("Failed to read {config_path:?}: {error}"));
    let config: Value = serde_json::from_str(&config_contents)
        .unwrap_or_else(|error| panic!("Failed to parse tauri.conf.json: {error}"));
    let external_bin = config
        .get("bundle")
        .and_then(|bundle| bundle.get("externalBin"))
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();

    assert!(
        external_bin
            .iter()
            .any(|value| value.as_str() == Some("binaries/codex-bundled")),
        "tauri.conf.json bundle.externalBin must include bundled Codex sidecar"
    );
}

#[test]
fn mobile_access_daemon_sidecars_are_declared_in_desktop_config() {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let config_path = manifest_dir.join("tauri.conf.json");
    let config_contents = fs::read_to_string(&config_path)
        .unwrap_or_else(|error| panic!("Failed to read {config_path:?}: {error}"));
    let config: Value = serde_json::from_str(&config_contents)
        .unwrap_or_else(|error| panic!("Failed to parse tauri.conf.json: {error}"));
    let external_bin = config
        .get("bundle")
        .and_then(|bundle| bundle.get("externalBin"))
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();

    for required_sidecar in [
        "binaries/codex_monitor_daemon",
        "binaries/codex_monitor_daemonctl",
    ] {
        assert!(
            external_bin
                .iter()
                .any(|value| value.as_str() == Some(required_sidecar)),
            "tauri.conf.json bundle.externalBin must include {required_sidecar}"
        );
    }
}

#[test]
fn bundled_git_resources_are_declared_in_desktop_config() {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let config_path = manifest_dir.join("tauri.conf.json");
    let config_contents = fs::read_to_string(&config_path)
        .unwrap_or_else(|error| panic!("Failed to read {config_path:?}: {error}"));
    let config: Value = serde_json::from_str(&config_contents)
        .unwrap_or_else(|error| panic!("Failed to parse tauri.conf.json: {error}"));
    let resources = config
        .get("bundle")
        .and_then(|bundle| bundle.get("resources"))
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();

    assert!(
        resources
            .iter()
            .any(|value| value.as_str() == Some("git-bundled")),
        "tauri.conf.json bundle.resources must include bundled Git runtime resources"
    );
}

#[test]
fn bundled_skills_resources_are_declared_in_desktop_config() {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let config_path = manifest_dir.join("tauri.conf.json");
    let config_contents = fs::read_to_string(&config_path)
        .unwrap_or_else(|error| panic!("Failed to read {config_path:?}: {error}"));
    let config: Value = serde_json::from_str(&config_contents)
        .unwrap_or_else(|error| panic!("Failed to parse tauri.conf.json: {error}"));
    let resources = config
        .get("bundle")
        .and_then(|bundle| bundle.get("resources"))
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();

    assert!(
        resources
            .iter()
            .any(|value| value.as_str() == Some("bundled-skills")),
        "tauri.conf.json bundle.resources must include bundled skills resources"
    );
}

#[test]
fn bundled_system_skills_snapshot_exists() {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let bundled_system_root = manifest_dir.join("bundled-skills").join(".system");

    assert!(
        bundled_system_root
            .join("openai-docs")
            .join("SKILL.md")
            .is_file(),
        "bundled system skills snapshot must include openai-docs"
    );
    assert!(
        bundled_system_root
            .join("skill-installer")
            .join("SKILL.md")
            .is_file(),
        "bundled system skills snapshot must include skill-installer"
    );
}
