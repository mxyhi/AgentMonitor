use reqwest::Url;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use toml_edit::{value, Document, Item, Table};

use crate::codex::home as codex_home;
use crate::shared::{config_toml_core, settings_core};

const AIROUTER_PROVIDER_ID: &str = "airouter";
const OPENAI_PROVIDER_ID: &str = "OpenAI";
const LOCAL_PROVIDER_ID: &str = "local";
const LEGACY_OPENAI_PROVIDER_ID: &str = "openai";
const LEGACY_OLLAMA_PROVIDER_ID: &str = "ollama";
const LEGACY_LMSTUDIO_PROVIDER_ID: &str = "lmstudio";

const AIROUTER_PROVIDER_NAME: &str = "airouter";
const OPENAI_PROVIDER_NAME: &str = "OpenAI";
const LOCAL_PROVIDER_NAME: &str = "local";

const DEFAULT_AIROUTER_BASE_URL: &str = "https://airouter.mxyhi.com/v1";
const DEFAULT_OPENAI_BASE_URL: &str = "https://api.openai.com/v1";
const DEFAULT_LOCAL_BASE_URL: &str = "http://127.0.0.1:9208/v1";
const DEFAULT_SESSION_MODEL: &str = "gpt-5.4";
const DEFAULT_SESSION_REASONING_EFFORT: &str = "high";
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
pub(crate) struct UpdateAiProviderSettingsInput {
    pub provider_id: String,
    pub base_url: Option<String>,
    pub api_key: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct ProviderState {
    id: &'static str,
    name: &'static str,
    default_base_url: &'static str,
    base_url: String,
    api_key: Option<String>,
}

pub(crate) fn get_global_ai_settings_core() -> Result<GlobalAiSettingsDto, String> {
    let codex_home = resolve_codex_home()?;
    let (_, document) = config_toml_core::load_global_config_document(&codex_home)?;
    let config_path = settings_core::get_codex_config_path_core()?;
    build_global_ai_settings_dto(config_path, &document)
}

pub(crate) fn load_app_server_runtime_overrides(codex_home: &Path) -> Result<Vec<String>, String> {
    let (_, document) = config_toml_core::load_global_config_document(codex_home)?;
    build_app_server_runtime_overrides_from_document(&document)
}

pub(crate) fn update_global_ai_session_defaults_core(
    input: UpdateGlobalAiSessionDefaultsInput,
) -> Result<GlobalAiSettingsDto, String> {
    validate_provider_reference(input.model_provider.as_deref())?;
    validate_reasoning_effort(input.model_reasoning_effort.as_deref())?;

    let codex_home = resolve_codex_home()?;
    let (_, mut document) = config_toml_core::load_global_config_document(&codex_home)?;
    normalize_document(&mut document)?;
    apply_session_defaults(&mut document, input)?;
    normalize_document(&mut document)?;
    config_toml_core::persist_global_config_document(&codex_home, &document)?;

    let config_path = settings_core::get_codex_config_path_core()?;
    build_global_ai_settings_dto(config_path, &document)
}

pub(crate) fn update_ai_provider_settings_core(
    input: UpdateAiProviderSettingsInput,
) -> Result<GlobalAiSettingsDto, String> {
    let provider_id = normalize_provider_reference(input.provider_id.as_str())
        .ok_or_else(|| format!("unsupported provider `{}`", input.provider_id.trim()))?;
    let normalized_base_url = normalize_provider_base_url(provider_id, input.base_url.as_deref())?;
    let normalized_api_key = normalize_optional_string(input.api_key.as_deref());

    let codex_home = resolve_codex_home()?;
    let (_, mut document) = config_toml_core::load_global_config_document(&codex_home)?;
    normalize_document(&mut document)?;

    let mut providers = resolve_provider_states(&document)?;
    let provider = providers
        .iter_mut()
        .find(|entry| entry.id == provider_id)
        .ok_or_else(|| format!("provider `{provider_id}` not found"))?;
    provider.base_url =
        normalized_base_url.unwrap_or_else(|| provider.default_base_url.to_string());
    provider.api_key = normalized_api_key;

    write_provider_states(&mut document, &providers)?;
    config_toml_core::set_top_level_string(&mut document, "model_provider", Some(provider_id));
    normalize_document(&mut document)?;
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
    let mut normalized = document.clone();
    normalize_document(&mut normalized)?;
    let providers = resolve_provider_states(&normalized)?;

    Ok(GlobalAiSettingsDto {
        config_path,
        session_defaults: GlobalAiSessionDefaultsDto {
            model_provider: config_toml_core::read_top_level_string(&normalized, "model_provider"),
            model: config_toml_core::read_top_level_string(&normalized, "model"),
            model_reasoning_effort: config_toml_core::read_top_level_string(
                &normalized,
                "model_reasoning_effort",
            ),
        },
        providers: providers
            .into_iter()
            .map(|provider| GlobalAiProviderEntryDto {
                id: provider.id.to_string(),
                name: provider.name.to_string(),
                base_url: Some(provider.base_url),
                api_key: provider.api_key,
                built_in: true,
            })
            .collect(),
    })
}

fn build_app_server_runtime_overrides_from_document(
    document: &Document,
) -> Result<Vec<String>, String> {
    let mut normalized = document.clone();
    normalize_document(&mut normalized)?;
    let providers = resolve_provider_states(&normalized)?;

    let mut overrides = Vec::new();
    if let Some(model_provider) =
        config_toml_core::read_top_level_string(&normalized, "model_provider")
    {
        overrides.push(format!(
            "model_provider={}",
            render_toml_string(model_provider.as_str())
        ));
    }
    if let Some(model) = config_toml_core::read_top_level_string(&normalized, "model") {
        overrides.push(format!("model={}", render_toml_string(model.as_str())));
    }
    if let Some(effort) =
        config_toml_core::read_top_level_string(&normalized, "model_reasoning_effort")
    {
        overrides.push(format!(
            "model_reasoning_effort={}",
            render_toml_string(effort.as_str())
        ));
    }
    overrides.push(format!(
        "model_providers={}",
        render_provider_states_inline_table(&providers)
    ));
    Ok(overrides)
}

fn normalize_document(document: &mut Document) -> Result<(), String> {
    let selected_provider =
        normalize_selected_provider(document.get("model_provider").and_then(Item::as_str))
            .unwrap_or(AIROUTER_PROVIDER_ID);
    let normalized_model = normalize_optional_string(document.get("model").and_then(Item::as_str))
        .or_else(|| Some(DEFAULT_SESSION_MODEL.to_string()));
    let normalized_effort = normalize_reasoning_effort(
        document
            .get("model_reasoning_effort")
            .and_then(Item::as_str),
    )
    .or_else(|| Some(DEFAULT_SESSION_REASONING_EFFORT.to_string()));
    let providers = resolve_provider_states(document)?;

    config_toml_core::set_top_level_string(document, "model_provider", Some(selected_provider));
    config_toml_core::set_top_level_string(document, "model", normalized_model.as_deref());
    config_toml_core::set_top_level_string(
        document,
        "model_reasoning_effort",
        normalized_effort.as_deref(),
    );
    let _ = document.remove("openai_base_url");
    write_provider_states(document, &providers)?;
    Ok(())
}

fn resolve_provider_states(document: &Document) -> Result<Vec<ProviderState>, String> {
    Ok(vec![
        ProviderState {
            id: AIROUTER_PROVIDER_ID,
            name: AIROUTER_PROVIDER_NAME,
            default_base_url: DEFAULT_AIROUTER_BASE_URL,
            base_url: resolve_provider_base_url(
                document,
                &[AIROUTER_PROVIDER_ID],
                None,
                DEFAULT_AIROUTER_BASE_URL,
            )?,
            api_key: resolve_provider_api_key(document, &[AIROUTER_PROVIDER_ID]),
        },
        ProviderState {
            id: OPENAI_PROVIDER_ID,
            name: OPENAI_PROVIDER_NAME,
            default_base_url: DEFAULT_OPENAI_BASE_URL,
            base_url: resolve_provider_base_url(
                document,
                &[OPENAI_PROVIDER_ID, LEGACY_OPENAI_PROVIDER_ID],
                config_toml_core::read_top_level_string(document, "openai_base_url"),
                DEFAULT_OPENAI_BASE_URL,
            )?,
            api_key: resolve_provider_api_key(
                document,
                &[OPENAI_PROVIDER_ID, LEGACY_OPENAI_PROVIDER_ID],
            ),
        },
        ProviderState {
            id: LOCAL_PROVIDER_ID,
            name: LOCAL_PROVIDER_NAME,
            default_base_url: DEFAULT_LOCAL_BASE_URL,
            base_url: resolve_provider_base_url(
                document,
                &[
                    LOCAL_PROVIDER_ID,
                    LEGACY_OLLAMA_PROVIDER_ID,
                    LEGACY_LMSTUDIO_PROVIDER_ID,
                ],
                None,
                DEFAULT_LOCAL_BASE_URL,
            )?,
            api_key: resolve_provider_api_key(
                document,
                &[
                    LOCAL_PROVIDER_ID,
                    LEGACY_OLLAMA_PROVIDER_ID,
                    LEGACY_LMSTUDIO_PROVIDER_ID,
                ],
            ),
        },
    ])
}

fn resolve_provider_base_url(
    document: &Document,
    provider_keys: &[&str],
    extra_value: Option<String>,
    default_base_url: &str,
) -> Result<String, String> {
    let canonical_provider_id =
        normalize_selected_provider(provider_keys.first().copied()).unwrap_or(AIROUTER_PROVIDER_ID);

    for provider_key in provider_keys {
        if let Some(base_url) = read_provider_field(document, provider_key, "base_url") {
            if let Some(normalized) =
                normalize_provider_base_url(canonical_provider_id, Some(base_url.as_str()))?
            {
                return Ok(normalized);
            }
        }
    }

    if let Some(base_url) = extra_value {
        if let Some(normalized) =
            normalize_provider_base_url(canonical_provider_id, Some(base_url.as_str()))?
        {
            return Ok(normalized);
        }
    }

    Ok(default_base_url.to_string())
}

fn resolve_provider_api_key(document: &Document, provider_keys: &[&str]) -> Option<String> {
    for provider_key in provider_keys {
        let Some(api_key) =
            read_provider_field(document, provider_key, "experimental_bearer_token")
        else {
            continue;
        };
        if let Some(normalized) = normalize_optional_string(Some(api_key.as_str())) {
            return Some(normalized);
        }
    }
    None
}

fn write_provider_states(
    document: &mut Document,
    providers: &[ProviderState],
) -> Result<(), String> {
    let mut table = Table::new();
    for provider in providers {
        table[provider.id] = Item::Table(build_provider_table(
            provider.name,
            provider.base_url.as_str(),
            provider.api_key.as_deref(),
        ));
    }
    document["model_providers"] = Item::Table(table);
    Ok(())
}

fn read_provider_field(document: &Document, provider_id: &str, field: &str) -> Option<String> {
    let providers = document.get("model_providers")?.as_table_like()?;
    let provider = providers.get(provider_id)?.as_table_like()?;
    normalize_optional_string(provider.get(field).and_then(Item::as_str))
}

fn apply_session_defaults(
    document: &mut Document,
    input: UpdateGlobalAiSessionDefaultsInput,
) -> Result<(), String> {
    let normalized_provider = match input.model_provider.as_deref() {
        Some(provider_id) => Some(
            normalize_provider_reference(provider_id)
                .ok_or_else(|| format!("unsupported provider `{}`", provider_id.trim()))?,
        ),
        None => None,
    };

    config_toml_core::set_top_level_string(document, "model_provider", normalized_provider);
    config_toml_core::set_top_level_string(
        document,
        "model",
        normalize_optional_string(input.model.as_deref()).as_deref(),
    );
    config_toml_core::set_top_level_string(
        document,
        "model_reasoning_effort",
        normalize_reasoning_effort(input.model_reasoning_effort.as_deref()).as_deref(),
    );
    Ok(())
}

fn build_provider_table(name: &str, base_url: &str, api_key: Option<&str>) -> Table {
    let mut table = Table::new();
    table["name"] = value(name);
    table["base_url"] = value(base_url);
    if let Some(api_key) = normalize_optional_string(api_key) {
        table["experimental_bearer_token"] = value(api_key);
    }
    table
}

fn render_provider_states_inline_table(providers: &[ProviderState]) -> String {
    let entries = providers
        .iter()
        .map(|provider| {
            format!(
                "{}={}",
                provider.id,
                render_provider_state_inline_table(provider)
            )
        })
        .collect::<Vec<_>>();
    format!("{{{}}}", entries.join(","))
}

fn render_provider_state_inline_table(provider: &ProviderState) -> String {
    let mut fields = vec![
        format!("name={}", render_toml_string(provider.name)),
        format!(
            "base_url={}",
            render_toml_string(provider.base_url.as_str())
        ),
    ];
    if let Some(api_key) = provider.api_key.as_deref() {
        fields.push(format!(
            "experimental_bearer_token={}",
            render_toml_string(api_key)
        ));
    }
    format!("{{{}}}", fields.join(","))
}

fn render_toml_string(value: &str) -> String {
    serde_json::to_string(value).expect("string literal")
}

fn validate_provider_reference(value: Option<&str>) -> Result<(), String> {
    let Some(value) = normalize_optional_string(value) else {
        return Ok(());
    };
    if normalize_provider_reference(value.as_str()).is_some() {
        Ok(())
    } else {
        Err(format!("unsupported provider `{value}`"))
    }
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

fn normalize_selected_provider(value: Option<&str>) -> Option<&'static str> {
    normalize_provider_reference(value?)
}

fn normalize_provider_reference(value: &str) -> Option<&'static str> {
    match value.trim().to_ascii_lowercase().as_str() {
        "airouter" => Some(AIROUTER_PROVIDER_ID),
        "openai" => Some(OPENAI_PROVIDER_ID),
        "local" | LEGACY_OLLAMA_PROVIDER_ID | LEGACY_LMSTUDIO_PROVIDER_ID => {
            Some(LOCAL_PROVIDER_ID)
        }
        _ => None,
    }
}

fn normalize_provider_base_url(
    provider_id: &str,
    value: Option<&str>,
) -> Result<Option<String>, String> {
    let Some(value) = normalize_optional_string(value) else {
        return Ok(None);
    };
    let parsed = Url::parse(value.as_str()).map_err(|err| format!("Invalid base URL: {err}"))?;
    if parsed.query().is_some() || parsed.fragment().is_some() {
        return Err("Invalid base URL: query and fragment are not allowed".to_string());
    }
    if !is_allowed_provider_base_url(provider_id, &parsed) {
        return Err(format!(
            "Invalid base URL for provider `{provider_id}`: {value}"
        ));
    }

    Ok(Some(render_normalized_base_url(&parsed)))
}

fn is_allowed_provider_base_url(provider_id: &str, parsed: &Url) -> bool {
    let Some(host) = parsed.host_str().map(|value| value.to_ascii_lowercase()) else {
        return false;
    };
    let scheme = parsed.scheme().to_ascii_lowercase();
    let path = normalize_url_path(parsed.path());

    if !matches!(path.as_str(), "/" | "/v1") {
        return false;
    }

    match provider_id {
        AIROUTER_PROVIDER_ID => {
            host == "airouter.mxyhi.com"
                && matches!(scheme.as_str(), "https" | "http")
                && parsed.port().is_none()
        }
        OPENAI_PROVIDER_ID => {
            host == "api.openai.com" && scheme == "https" && parsed.port().is_none()
        }
        LOCAL_PROVIDER_ID => matches!(host.as_str(), "127.0.0.1" | "localhost") && scheme == "http",
        _ => false,
    }
}

fn render_normalized_base_url(parsed: &Url) -> String {
    let host = parsed.host_str().unwrap_or_default();
    let mut rendered = format!("{}://{}", parsed.scheme(), host);
    if let Some(port) = parsed.port() {
        rendered.push(':');
        rendered.push_str(port.to_string().as_str());
    }
    let path = normalize_url_path(parsed.path());
    if path != "/" {
        rendered.push_str(path.as_str());
    }
    rendered
}

fn normalize_url_path(path: &str) -> String {
    if path == "/" {
        return "/".to_string();
    }
    let trimmed = path.trim_end_matches('/');
    if trimmed.is_empty() {
        "/".to_string()
    } else {
        trimmed.to_string()
    }
}

fn normalize_reasoning_effort(value: Option<&str>) -> Option<String> {
    let normalized = normalize_optional_string(value)?;
    if ALLOWED_REASONING_EFFORTS.contains(&normalized.as_str()) {
        Some(normalized)
    } else {
        None
    }
}

fn normalize_optional_string(value: Option<&str>) -> Option<String> {
    let trimmed = value?.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use toml_edit::Item;

    fn parse(input: &str) -> Document {
        input.parse::<Document>().expect("valid toml")
    }

    fn provider<'a>(
        dto: &'a GlobalAiSettingsDto,
        provider_id: &str,
    ) -> &'a GlobalAiProviderEntryDto {
        dto.providers
            .iter()
            .find(|provider| provider.id == provider_id)
            .expect("provider exists")
    }

    #[test]
    fn normalizes_document_to_fixed_provider_set() {
        let mut document = parse(
            r#"
model_provider = "openai"
model = "gpt-5.1"
model_reasoning_effort = "high"
openai_base_url = "https://api.openai.com/v1"

[model_providers.openai]
name = "OpenAI"
base_url = "https://api.openai.com/v1"
experimental_bearer_token = "sk-openai"

[model_providers.airouter]
name = "Custom Airouter"
base_url = "https://airouter.mxyhi.com/v1/"
experimental_bearer_token = "sk-airouter"

[model_providers.ollama]
name = "Ollama"
base_url = "http://localhost:9208/v1/"

[model_providers.somewhere]
name = "Somewhere"
base_url = "https://example.com/v1"
experimental_bearer_token = "sk-elsewhere"
"#,
        );

        normalize_document(&mut document).expect("normalize");
        let dto =
            build_global_ai_settings_dto("/tmp/config.toml".to_string(), &document).expect("dto");

        assert_eq!(
            dto.session_defaults.model_provider.as_deref(),
            Some("OpenAI")
        );
        assert_eq!(dto.session_defaults.model.as_deref(), Some("gpt-5.1"));
        assert_eq!(
            dto.session_defaults.model_reasoning_effort.as_deref(),
            Some("high")
        );
        assert_eq!(
            dto.providers
                .iter()
                .map(|provider| provider.id.as_str())
                .collect::<Vec<_>>(),
            vec!["airouter", "OpenAI", "local"]
        );
        assert_eq!(
            provider(&dto, "airouter").base_url.as_deref(),
            Some("https://airouter.mxyhi.com/v1")
        );
        assert_eq!(
            provider(&dto, "airouter").api_key.as_deref(),
            Some("sk-airouter")
        );
        assert_eq!(
            provider(&dto, "OpenAI").base_url.as_deref(),
            Some("https://api.openai.com/v1")
        );
        assert_eq!(
            provider(&dto, "OpenAI").api_key.as_deref(),
            Some("sk-openai")
        );
        assert_eq!(
            provider(&dto, "local").base_url.as_deref(),
            Some("http://localhost:9208/v1")
        );
        assert!(document.get("openai_base_url").is_none());
        let providers = document
            .get("model_providers")
            .and_then(Item::as_table_like)
            .expect("providers table");
        assert!(providers.contains_key("airouter"));
        assert!(providers.contains_key("OpenAI"));
        assert!(providers.contains_key("local"));
        assert!(!providers.contains_key("openai"));
        assert!(!providers.contains_key("ollama"));
        assert!(!providers.contains_key("somewhere"));
    }

    #[test]
    fn normalize_airouter_base_url_rejects_disallowed_values() {
        assert_eq!(
            normalize_provider_base_url(
                AIROUTER_PROVIDER_ID,
                Some("https://airouter.mxyhi.com/v1/")
            )
            .expect("allowed"),
            Some("https://airouter.mxyhi.com/v1".to_string())
        );
        assert!(normalize_provider_base_url(
            AIROUTER_PROVIDER_ID,
            Some("https://api.openai.com/v1")
        )
        .is_err());
        assert!(normalize_provider_base_url(
            AIROUTER_PROVIDER_ID,
            Some("http://localhost:9208/v1")
        )
        .is_err());
    }

    #[test]
    fn invalid_selected_provider_falls_back_to_airouter() {
        let mut document = parse(
            r#"
model_provider = "unknown"
"#,
        );

        normalize_document(&mut document).expect("normalize");

        assert_eq!(
            config_toml_core::read_top_level_string(&document, "model_provider").as_deref(),
            Some("airouter")
        );
    }

    #[test]
    fn local_provider_defaults_to_9208() {
        let dto =
            build_global_ai_settings_dto("/tmp/config.toml".to_string(), &parse("")).expect("dto");

        assert_eq!(
            provider(&dto, "local").base_url.as_deref(),
            Some("http://127.0.0.1:9208/v1")
        );
    }

    #[test]
    fn empty_config_defaults_session_defaults_to_gpt_5_4_high() {
        let dto =
            build_global_ai_settings_dto("/tmp/config.toml".to_string(), &parse("")).expect("dto");

        assert_eq!(
            dto.session_defaults.model_provider.as_deref(),
            Some("airouter")
        );
        assert_eq!(dto.session_defaults.model.as_deref(), Some("gpt-5.4"));
        assert_eq!(
            dto.session_defaults.model_reasoning_effort.as_deref(),
            Some("high")
        );
    }

    #[test]
    fn app_server_runtime_overrides_pin_fixed_provider_config() {
        let overrides = build_app_server_runtime_overrides_from_document(&parse(
            r#"
model_provider = "local"
model = "gpt-5.4"
model_reasoning_effort = "high"

[model_providers.local]
name = "local"
base_url = "http://127.0.0.1:9208/v1"
experimental_bearer_token = "sk-888"
"#,
        ))
        .expect("overrides");

        assert!(overrides.contains(&"model_provider=\"local\"".to_string()));
        assert!(overrides.contains(&"model=\"gpt-5.4\"".to_string()));
        assert!(overrides.contains(&"model_reasoning_effort=\"high\"".to_string()));
        let provider_override = overrides
            .iter()
            .find(|override_entry| override_entry.starts_with("model_providers="))
            .expect("provider override");
        assert!(provider_override
            .contains(r#"airouter={name="airouter",base_url="https://airouter.mxyhi.com/v1"}"#));
        assert!(provider_override
            .contains(r#"OpenAI={name="OpenAI",base_url="https://api.openai.com/v1"}"#));
        assert!(provider_override.contains(
            r#"local={name="local",base_url="http://127.0.0.1:9208/v1",experimental_bearer_token="sk-888"}"#
        ));
    }
}
