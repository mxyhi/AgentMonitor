use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use toml_edit::{value, Document, Item, Table};

use crate::codex::home as codex_home;
use crate::shared::{config_toml_core, settings_core};

const OPENAI_PROVIDER_ID: &str = "openai";
const OLLAMA_PROVIDER_ID: &str = "ollama";
const LMSTUDIO_PROVIDER_ID: &str = "lmstudio";
const DEFAULT_OLLAMA_BASE_URL: &str = "http://localhost:11434/v1";
const DEFAULT_LMSTUDIO_BASE_URL: &str = "http://localhost:1234/v1";
const ALLOWED_REASONING_EFFORTS: &[&str] = &["minimal", "low", "medium", "high", "xhigh"];

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct GlobalAiSessionDefaultsDto {
    pub model_provider: Option<String>,
    pub model: Option<String>,
    pub model_reasoning_effort: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct GlobalAiProviderEntryDto {
    pub id: String,
    pub name: String,
    pub base_url: Option<String>,
    pub api_key: Option<String>,
    pub built_in: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct GlobalAiSettingsDto {
    pub config_path: String,
    pub session_defaults: GlobalAiSessionDefaultsDto,
    pub openai_base_url: Option<String>,
    pub providers: Vec<GlobalAiProviderEntryDto>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct UpdateGlobalAiSessionDefaultsInput {
    pub model_provider: Option<String>,
    pub model: Option<String>,
    pub model_reasoning_effort: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct UpdateOpenAiBaseUrlInput {
    pub base_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CreateCustomAiProviderInput {
    pub id: String,
    pub name: Option<String>,
    pub base_url: Option<String>,
    pub api_key: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct UpdateCustomAiProviderInput {
    pub original_id: String,
    pub id: String,
    pub name: Option<String>,
    pub base_url: Option<String>,
    pub api_key: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DeleteCustomAiProviderInput {
    pub id: String,
}

pub(crate) fn get_global_ai_settings_core() -> Result<GlobalAiSettingsDto, String> {
    let codex_home = resolve_codex_home()?;
    let (_, document) = config_toml_core::load_global_config_document(&codex_home)?;
    let config_path = settings_core::get_codex_config_path_core()?;
    build_global_ai_settings_dto(config_path, &document)
}

pub(crate) fn update_global_ai_session_defaults_core(
    input: UpdateGlobalAiSessionDefaultsInput,
) -> Result<GlobalAiSettingsDto, String> {
    validate_provider_reference(input.model_provider.as_deref())?;
    validate_reasoning_effort(input.model_reasoning_effort.as_deref())?;

    let codex_home = resolve_codex_home()?;
    let (_, mut document) = config_toml_core::load_global_config_document(&codex_home)?;
    apply_session_defaults(&mut document, input)?;
    config_toml_core::persist_global_config_document(&codex_home, &document)?;
    let config_path = settings_core::get_codex_config_path_core()?;
    build_global_ai_settings_dto(config_path, &document)
}

pub(crate) fn update_openai_base_url_core(
    input: UpdateOpenAiBaseUrlInput,
) -> Result<GlobalAiSettingsDto, String> {
    let codex_home = resolve_codex_home()?;
    let (_, mut document) = config_toml_core::load_global_config_document(&codex_home)?;
    config_toml_core::set_top_level_string(
        &mut document,
        "openai_base_url",
        normalize_optional_string(input.base_url.as_deref()).as_deref(),
    );
    config_toml_core::persist_global_config_document(&codex_home, &document)?;
    let config_path = settings_core::get_codex_config_path_core()?;
    build_global_ai_settings_dto(config_path, &document)
}

pub(crate) fn create_custom_ai_provider_core(
    input: CreateCustomAiProviderInput,
) -> Result<GlobalAiSettingsDto, String> {
    let provider_id = normalize_custom_provider_id(input.id.as_str())?;
    let provider_name = resolve_provider_name(provider_id.as_str(), input.name.as_deref());

    let codex_home = resolve_codex_home()?;
    let (_, mut document) = config_toml_core::load_global_config_document(&codex_home)?;
    let providers = config_toml_core::ensure_table(&mut document, "model_providers")?;
    if has_provider_conflict(providers, provider_id.as_str(), None) {
        return Err(format!("provider `{provider_id}` already exists"));
    }
    providers[&provider_id] = Item::Table(build_provider_table(
        provider_name.as_str(),
        input.base_url.as_deref(),
        input.api_key.as_deref(),
    ));

    config_toml_core::persist_global_config_document(&codex_home, &document)?;
    let config_path = settings_core::get_codex_config_path_core()?;
    build_global_ai_settings_dto(config_path, &document)
}

pub(crate) fn update_custom_ai_provider_core(
    input: UpdateCustomAiProviderInput,
) -> Result<GlobalAiSettingsDto, String> {
    let original_id = normalize_existing_provider_id(input.original_id.as_str())?;
    let provider_id = normalize_custom_provider_id(input.id.as_str())?;
    let provider_name = resolve_provider_name(provider_id.as_str(), input.name.as_deref());

    let codex_home = resolve_codex_home()?;
    let (_, mut document) = config_toml_core::load_global_config_document(&codex_home)?;
    let providers = config_toml_core::ensure_table(&mut document, "model_providers")?;
    if !providers.contains_key(&original_id) {
        return Err(format!("provider `{original_id}` not found"));
    }
    if has_provider_conflict(providers, provider_id.as_str(), Some(original_id.as_str())) {
        return Err(format!("provider `{provider_id}` already exists"));
    }

    let _ = providers.remove(&original_id);
    providers[&provider_id] = Item::Table(build_provider_table(
        provider_name.as_str(),
        input.base_url.as_deref(),
        input.api_key.as_deref(),
    ));

    let current_provider =
        read_optional_trimmed(document.get("model_provider").and_then(Item::as_str));
    if current_provider.as_deref() == Some(original_id.as_str()) && provider_id != original_id {
        document["model_provider"] = value(provider_id.as_str());
    }

    config_toml_core::persist_global_config_document(&codex_home, &document)?;
    let config_path = settings_core::get_codex_config_path_core()?;
    build_global_ai_settings_dto(config_path, &document)
}

pub(crate) fn delete_custom_ai_provider_core(
    input: DeleteCustomAiProviderInput,
) -> Result<GlobalAiSettingsDto, String> {
    let provider_id = normalize_existing_provider_id(input.id.as_str())?;

    let codex_home = resolve_codex_home()?;
    let (_, mut document) = config_toml_core::load_global_config_document(&codex_home)?;
    let providers = config_toml_core::ensure_table(&mut document, "model_providers")?;
    if providers.remove(&provider_id).is_none() {
        return Err(format!("provider `{provider_id}` not found"));
    }

    let current_provider =
        read_optional_trimmed(document.get("model_provider").and_then(Item::as_str));
    if current_provider.as_deref() == Some(provider_id.as_str()) {
        document["model_provider"] = value(OPENAI_PROVIDER_ID);
    }

    config_toml_core::persist_global_config_document(&codex_home, &document)?;
    let config_path = settings_core::get_codex_config_path_core()?;
    build_global_ai_settings_dto(config_path, &document)
}

fn resolve_codex_home() -> Result<PathBuf, String> {
    codex_home::resolve_default_codex_home()
        .ok_or_else(|| "Unable to resolve CODEX_HOME".to_string())
}

fn build_global_ai_settings_dto(
    config_path: String,
    document: &Document,
) -> Result<GlobalAiSettingsDto, String> {
    let openai_base_url = config_toml_core::read_top_level_string(document, "openai_base_url");
    let mut providers = built_in_provider_entries(openai_base_url.clone());
    providers.extend(read_custom_provider_entries(document));
    providers.sort_by(|left, right| {
        if left.built_in != right.built_in {
            return right.built_in.cmp(&left.built_in);
        }
        left.id.cmp(&right.id)
    });

    Ok(GlobalAiSettingsDto {
        config_path,
        session_defaults: GlobalAiSessionDefaultsDto {
            model_provider: config_toml_core::read_top_level_string(document, "model_provider"),
            model: config_toml_core::read_top_level_string(document, "model"),
            model_reasoning_effort: config_toml_core::read_top_level_string(
                document,
                "model_reasoning_effort",
            ),
        },
        openai_base_url,
        providers,
    })
}

fn built_in_provider_entries(openai_base_url: Option<String>) -> Vec<GlobalAiProviderEntryDto> {
    vec![
        GlobalAiProviderEntryDto {
            id: OPENAI_PROVIDER_ID.to_string(),
            name: "OpenAI".to_string(),
            base_url: openai_base_url,
            api_key: None,
            built_in: true,
        },
        GlobalAiProviderEntryDto {
            id: OLLAMA_PROVIDER_ID.to_string(),
            name: "gpt-oss".to_string(),
            base_url: Some(DEFAULT_OLLAMA_BASE_URL.to_string()),
            api_key: None,
            built_in: true,
        },
        GlobalAiProviderEntryDto {
            id: LMSTUDIO_PROVIDER_ID.to_string(),
            name: "gpt-oss".to_string(),
            base_url: Some(DEFAULT_LMSTUDIO_BASE_URL.to_string()),
            api_key: None,
            built_in: true,
        },
    ]
}

fn read_custom_provider_entries(document: &Document) -> Vec<GlobalAiProviderEntryDto> {
    let mut entries = Vec::new();
    let Some(table_like) = document
        .get("model_providers")
        .and_then(Item::as_table_like)
    else {
        return entries;
    };

    for (id, item) in table_like.iter() {
        let Some(provider_table) = item.as_table_like() else {
            continue;
        };
        entries.push(GlobalAiProviderEntryDto {
            id: id.to_string(),
            name: read_optional_trimmed(provider_table.get("name").and_then(Item::as_str))
                .unwrap_or_else(|| id.to_string()),
            base_url: read_optional_trimmed(provider_table.get("base_url").and_then(Item::as_str)),
            api_key: read_optional_trimmed(
                provider_table
                    .get("experimental_bearer_token")
                    .and_then(Item::as_str),
            ),
            built_in: false,
        });
    }

    entries
}

fn apply_session_defaults(
    document: &mut Document,
    input: UpdateGlobalAiSessionDefaultsInput,
) -> Result<(), String> {
    config_toml_core::set_top_level_string(
        document,
        "model_provider",
        normalize_optional_string(input.model_provider.as_deref()).as_deref(),
    );
    config_toml_core::set_top_level_string(
        document,
        "model",
        normalize_optional_string(input.model.as_deref()).as_deref(),
    );
    config_toml_core::set_top_level_string(
        document,
        "model_reasoning_effort",
        normalize_optional_string(input.model_reasoning_effort.as_deref()).as_deref(),
    );
    Ok(())
}

fn build_provider_table(name: &str, base_url: Option<&str>, api_key: Option<&str>) -> Table {
    let mut table = Table::new();
    table["name"] = value(name);
    if let Some(base_url_value) = normalize_optional_string(base_url) {
        table["base_url"] = value(base_url_value);
    }
    if let Some(api_key_value) = normalize_optional_string(api_key) {
        table["experimental_bearer_token"] = value(api_key_value);
    }
    table
}

fn validate_provider_reference(value: Option<&str>) -> Result<(), String> {
    let Some(provider_id) = normalize_optional_string(value) else {
        return Ok(());
    };
    if is_reserved_provider_id(provider_id.as_str()) {
        return Ok(());
    }
    Ok(())
}

fn validate_reasoning_effort(value: Option<&str>) -> Result<(), String> {
    let Some(value) = normalize_optional_string(value) else {
        return Ok(());
    };
    if ALLOWED_REASONING_EFFORTS.contains(&value.as_str()) {
        Ok(())
    } else {
        Err(format!("unsupported reasoning effort `{value}`"))
    }
}

fn normalize_custom_provider_id(value: &str) -> Result<String, String> {
    let normalized = normalize_existing_provider_id(value)?;
    if is_reserved_provider_id(normalized.as_str()) {
        return Err(format!(
            "provider id `{normalized}` is reserved for a built-in provider"
        ));
    }
    Ok(normalized)
}

fn normalize_existing_provider_id(value: &str) -> Result<String, String> {
    let normalized = value.trim().to_string();
    if normalized.is_empty() {
        return Err("provider id is required".to_string());
    }
    Ok(normalized)
}

fn resolve_provider_name(provider_id: &str, value: Option<&str>) -> String {
    normalize_optional_string(value).unwrap_or_else(|| provider_id.to_string())
}

fn normalize_optional_string(value: Option<&str>) -> Option<String> {
    read_optional_trimmed(value)
}

fn read_optional_trimmed(value: Option<&str>) -> Option<String> {
    let trimmed = value?.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

fn is_reserved_provider_id(value: &str) -> bool {
    matches!(
        value,
        OPENAI_PROVIDER_ID | OLLAMA_PROVIDER_ID | LMSTUDIO_PROVIDER_ID
    )
}

fn has_provider_conflict(providers: &Table, id: &str, excluding: Option<&str>) -> bool {
    providers.iter().any(|(existing_id, item)| {
        if !item.is_table_like() {
            return false;
        }
        if excluding.is_some_and(|value| value == existing_id) {
            return false;
        }
        existing_id.eq_ignore_ascii_case(id)
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn parse(input: &str) -> Document {
        input.parse::<Document>().expect("valid toml")
    }

    #[test]
    fn reads_built_in_and_custom_providers() {
        let document = parse(
            r#"
model_provider = "openai-custom"
model = "gpt-5.1"
model_reasoning_effort = "high"
openai_base_url = "https://api.example.com/v1"

[model_providers.openai-custom]
name = "OpenAI Custom"
base_url = "https://gateway.example.com/v1"
experimental_bearer_token = "sk-test-openai-custom"
"#,
        );

        let dto =
            build_global_ai_settings_dto("/tmp/config.toml".to_string(), &document).expect("dto");
        assert_eq!(
            dto.session_defaults.model_provider.as_deref(),
            Some("openai-custom")
        );
        assert_eq!(dto.session_defaults.model.as_deref(), Some("gpt-5.1"));
        assert_eq!(
            dto.session_defaults.model_reasoning_effort.as_deref(),
            Some("high")
        );
        assert_eq!(
            dto.openai_base_url.as_deref(),
            Some("https://api.example.com/v1")
        );
        assert!(dto.providers.iter().any(|provider| {
            provider.id == "openai"
                && provider.built_in
                && provider.base_url.as_deref() == Some("https://api.example.com/v1")
        }));
        assert!(dto.providers.iter().any(|provider| {
            provider.id == "openai-custom"
                && !provider.built_in
                && provider.base_url.as_deref() == Some("https://gateway.example.com/v1")
                && provider.api_key.as_deref() == Some("sk-test-openai-custom")
        }));
    }

    #[test]
    fn updates_session_defaults_without_touching_unknown_keys() {
        let mut document = parse(
            r#"
model = "gpt-4.1"
foo = "keep"
"#,
        );

        apply_session_defaults(
            &mut document,
            UpdateGlobalAiSessionDefaultsInput {
                model_provider: Some("openai".to_string()),
                model: Some("gpt-5.1".to_string()),
                model_reasoning_effort: Some("medium".to_string()),
            },
        )
        .expect("update");

        assert_eq!(
            config_toml_core::read_top_level_string(&document, "model_provider").as_deref(),
            Some("openai")
        );
        assert_eq!(
            config_toml_core::read_top_level_string(&document, "model").as_deref(),
            Some("gpt-5.1")
        );
        assert_eq!(
            config_toml_core::read_top_level_string(&document, "model_reasoning_effort").as_deref(),
            Some("medium")
        );
        assert_eq!(
            config_toml_core::read_top_level_string(&document, "foo").as_deref(),
            Some("keep")
        );
    }

    #[test]
    fn deleting_selected_provider_falls_back_to_openai() {
        let mut document = parse(
            r#"
model_provider = "openai-custom"

[model_providers.openai-custom]
name = "OpenAI Custom"
"#,
        );

        let providers = config_toml_core::ensure_table(&mut document, "model_providers")
            .expect("providers table");
        let removed = providers.remove("openai-custom");
        assert!(removed.is_some());

        let current_provider =
            read_optional_trimmed(document.get("model_provider").and_then(Item::as_str));
        if current_provider.as_deref() == Some("openai-custom") {
            document["model_provider"] = value(OPENAI_PROVIDER_ID);
        }

        assert_eq!(
            config_toml_core::read_top_level_string(&document, "model_provider").as_deref(),
            Some("openai")
        );
    }

    #[test]
    fn resolves_provider_name_to_id_when_missing() {
        assert_eq!(resolve_provider_name("gateway", None), "gateway");
        assert_eq!(resolve_provider_name("gateway", Some("")), "gateway");
        assert_eq!(resolve_provider_name("gateway", Some("   ")), "gateway");
        assert_eq!(
            resolve_provider_name("gateway", Some(" Gateway Custom ")),
            "Gateway Custom"
        );
    }
}
