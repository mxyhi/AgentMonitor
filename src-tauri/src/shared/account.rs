use base64::Engine;
use serde_json::{Map, Value};
use std::fs;
use std::path::PathBuf;

const OPENAI_PROVIDER_ID: &str = "openai";

#[derive(Clone, Debug)]
pub(crate) struct AuthAccount {
    pub(crate) email: Option<String>,
    pub(crate) plan_type: Option<String>,
}

pub(crate) fn build_account_response(
    response: Option<Value>,
    fallback: Option<AuthAccount>,
) -> Value {
    let mut account = response
        .as_ref()
        .and_then(extract_account_map)
        .unwrap_or_default();
    if let Some(fallback) = fallback {
        let account_type = account
            .get("type")
            .and_then(|value| value.as_str())
            .map(|value| value.to_ascii_lowercase());
        let allow_fallback = account.is_empty()
            || matches!(
                account_type.as_deref(),
                None | Some("chatgpt") | Some("unknown")
            );
        if allow_fallback {
            if !account.contains_key("email") {
                if let Some(email) = fallback.email {
                    account.insert("email".to_string(), Value::String(email));
                }
            }
            if !account.contains_key("planType") {
                if let Some(plan) = fallback.plan_type {
                    account.insert("planType".to_string(), Value::String(plan));
                }
            }
            if !account.contains_key("type") {
                account.insert("type".to_string(), Value::String("chatgpt".to_string()));
            }
        }
    }

    let account_value = if account.is_empty() {
        Value::Null
    } else {
        Value::Object(account)
    };
    let mut result = Map::new();
    result.insert("account".to_string(), account_value);
    if let Some(requires_openai_auth) = response.as_ref().and_then(extract_requires_openai_auth) {
        result.insert(
            "requiresOpenaiAuth".to_string(),
            Value::Bool(requires_openai_auth),
        );
    }
    Value::Object(result)
}

pub(crate) fn requires_openai_auth_without_account(value: &Value) -> bool {
    let requires_openai_auth = extract_requires_openai_auth(value).unwrap_or(false);
    if !requires_openai_auth {
        return false;
    }

    let account = extract_account_map(value);
    let Some(account) = account else {
        return true;
    };

    let account_type = account
        .get("type")
        .and_then(Value::as_str)
        .map(|value| value.trim().to_ascii_lowercase())
        .filter(|value| !value.is_empty());
    let has_email = account
        .get("email")
        .and_then(Value::as_str)
        .is_some_and(|value| !value.trim().is_empty());
    let has_plan_type = account
        .get("planType")
        .and_then(Value::as_str)
        .is_some_and(|value| !value.trim().is_empty());

    !matches!(account_type.as_deref(), Some("chatgpt") | Some("apikey"))
        && !has_email
        && !has_plan_type
}

pub(crate) fn requires_openai_auth_for_selected_provider(
    selected_provider_id: Option<&str>,
    selected_provider_api_key: Option<&str>,
    value: &Value,
) -> bool {
    selected_provider_requires_openai_auth(selected_provider_id, selected_provider_api_key)
        && requires_openai_auth_without_account(value)
}

fn selected_provider_requires_openai_auth(
    selected_provider_id: Option<&str>,
    selected_provider_api_key: Option<&str>,
) -> bool {
    let is_openai = selected_provider_id
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(|value| value.eq_ignore_ascii_case(OPENAI_PROVIDER_ID))
        .unwrap_or(false);
    if !is_openai {
        return false;
    }

    !selected_provider_api_key
        .map(str::trim)
        .is_some_and(|value| !value.is_empty())
}

pub(crate) fn read_auth_account(codex_home: Option<PathBuf>) -> Option<AuthAccount> {
    let codex_home = codex_home?;
    let auth_path = codex_home.join("auth.json");
    let data = fs::read(auth_path).ok()?;
    let auth_value: Value = serde_json::from_slice(&data).ok()?;
    let tokens = auth_value.get("tokens")?;
    let id_token = tokens
        .get("idToken")
        .or_else(|| tokens.get("id_token"))
        .and_then(|value| value.as_str())?;
    let payload = decode_jwt_payload(id_token)?;

    let auth_dict = payload
        .get("https://api.openai.com/auth")
        .and_then(|value| value.as_object());
    let profile_dict = payload
        .get("https://api.openai.com/profile")
        .and_then(|value| value.as_object());
    let plan = normalize_string(
        auth_dict
            .and_then(|dict| dict.get("chatgpt_plan_type"))
            .or_else(|| payload.get("chatgpt_plan_type")),
    );
    let email = normalize_string(
        payload
            .get("email")
            .or_else(|| profile_dict.and_then(|dict| dict.get("email"))),
    );

    if email.is_none() && plan.is_none() {
        return None;
    }

    Some(AuthAccount {
        email,
        plan_type: plan,
    })
}

fn extract_account_map(value: &Value) -> Option<Map<String, Value>> {
    let account = value
        .get("account")
        .or_else(|| value.get("result").and_then(|result| result.get("account")))
        .and_then(|value| value.as_object().cloned());
    if account.is_some() {
        return account;
    }
    let root = value.as_object()?;
    if root.contains_key("email") || root.contains_key("planType") || root.contains_key("type") {
        return Some(root.clone());
    }
    None
}

fn extract_requires_openai_auth(value: &Value) -> Option<bool> {
    value
        .get("requiresOpenaiAuth")
        .or_else(|| value.get("requires_openai_auth"))
        .or_else(|| {
            value
                .get("result")
                .and_then(|result| result.get("requiresOpenaiAuth"))
        })
        .or_else(|| {
            value
                .get("result")
                .and_then(|result| result.get("requires_openai_auth"))
        })
        .and_then(|value| value.as_bool())
}

fn decode_jwt_payload(token: &str) -> Option<Value> {
    let payload = token.split('.').nth(1)?;
    let decoded = base64::engine::general_purpose::URL_SAFE_NO_PAD
        .decode(payload.as_bytes())
        .or_else(|_| base64::engine::general_purpose::URL_SAFE.decode(payload.as_bytes()))
        .ok()?;
    serde_json::from_slice(&decoded).ok()
}

fn normalize_string(value: Option<&Value>) -> Option<String> {
    value
        .and_then(|value| value.as_str())
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn fallback_account() -> AuthAccount {
        AuthAccount {
            email: Some("chatgpt@example.com".to_string()),
            plan_type: Some("plus".to_string()),
        }
    }

    fn result_account_map(value: &Value) -> Map<String, Value> {
        value
            .get("account")
            .and_then(Value::as_object)
            .cloned()
            .unwrap_or_default()
    }

    #[test]
    fn build_account_response_does_not_fallback_for_apikey() {
        let response = Some(json!({
            "account": {
                "type": "apikey"
            }
        }));
        let result = build_account_response(response, Some(fallback_account()));
        let account = result_account_map(&result);

        assert_eq!(account.get("type").and_then(Value::as_str), Some("apikey"));
        assert!(!account.contains_key("email"));
        assert!(!account.contains_key("planType"));
    }

    #[test]
    fn build_account_response_falls_back_when_account_missing() {
        let result = build_account_response(None, Some(fallback_account()));
        let account = result_account_map(&result);

        assert_eq!(
            account.get("email").and_then(Value::as_str),
            Some("chatgpt@example.com"),
        );
        assert_eq!(
            account.get("planType").and_then(Value::as_str),
            Some("plus")
        );
        assert_eq!(account.get("type").and_then(Value::as_str), Some("chatgpt"));
    }

    #[test]
    fn build_account_response_allows_fallback_for_chatgpt_type() {
        let response = Some(json!({
            "account": {
                "type": "chatgpt"
            }
        }));
        let result = build_account_response(response, Some(fallback_account()));
        let account = result_account_map(&result);

        assert_eq!(account.get("type").and_then(Value::as_str), Some("chatgpt"));
        assert_eq!(
            account.get("email").and_then(Value::as_str),
            Some("chatgpt@example.com"),
        );
        assert_eq!(
            account.get("planType").and_then(Value::as_str),
            Some("plus")
        );
    }

    #[test]
    fn requires_openai_auth_without_account_rejects_missing_account() {
        assert!(requires_openai_auth_without_account(&json!({
            "requiresOpenaiAuth": true,
            "account": null
        })));
    }

    #[test]
    fn requires_openai_auth_without_account_allows_known_chatgpt_account() {
        assert!(!requires_openai_auth_without_account(&json!({
            "requiresOpenaiAuth": true,
            "account": {
                "type": "chatgpt",
                "email": "chatgpt@example.com"
            }
        })));
    }

    #[test]
    fn requires_openai_auth_for_selected_provider_skips_non_openai_provider() {
        assert!(!requires_openai_auth_for_selected_provider(
            Some("gateway"),
            None,
            &json!({
                "requiresOpenaiAuth": true,
                "account": null
            }),
        ));
    }

    #[test]
    fn requires_openai_auth_for_selected_provider_skips_missing_provider() {
        assert!(!requires_openai_auth_for_selected_provider(
            None,
            None,
            &json!({
                "requiresOpenaiAuth": true,
                "account": null
            }),
        ));
    }

    #[test]
    fn requires_openai_auth_for_selected_provider_skips_openai_with_api_key() {
        assert!(!requires_openai_auth_for_selected_provider(
            Some("openai"),
            Some("sk-test"),
            &json!({
                "requiresOpenaiAuth": true,
                "account": null
            }),
        ));
    }
}
