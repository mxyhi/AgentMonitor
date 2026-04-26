pub(crate) fn normalize_git_path(path: &str) -> String {
    path.replace('\\', "/")
}

pub(crate) fn normalize_windows_namespace_path(path: &str) -> String {
    if path.is_empty() {
        return String::new();
    }

    fn strip_prefix_ascii_case<'a>(value: &'a str, prefix: &str) -> Option<&'a str> {
        value
            .get(..prefix.len())
            .filter(|candidate| candidate.eq_ignore_ascii_case(prefix))
            .map(|_| &value[prefix.len()..])
    }

    fn starts_with_drive_path(value: &str) -> bool {
        let bytes = value.as_bytes();
        bytes.len() >= 3
            && bytes[0].is_ascii_alphabetic()
            && bytes[1] == b':'
            && (bytes[2] == b'\\' || bytes[2] == b'/')
    }

    if let Some(rest) = strip_prefix_ascii_case(path, r"\\?\UNC\") {
        return format!(r"\\{rest}");
    }
    if let Some(rest) = strip_prefix_ascii_case(path, "//?/UNC/") {
        return format!("//{rest}");
    }
    if let Some(rest) =
        strip_prefix_ascii_case(path, r"\\?\").filter(|rest| starts_with_drive_path(rest))
    {
        return rest.to_string();
    }
    if let Some(rest) =
        strip_prefix_ascii_case(path, "//?/").filter(|rest| starts_with_drive_path(rest))
    {
        return rest.to_string();
    }
    if let Some(rest) =
        strip_prefix_ascii_case(path, r"\\.\").filter(|rest| starts_with_drive_path(rest))
    {
        return rest.to_string();
    }
    if let Some(rest) =
        strip_prefix_ascii_case(path, "//./").filter(|rest| starts_with_drive_path(rest))
    {
        return rest.to_string();
    }

    path.to_string()
}
#[cfg(test)]
mod tests {
    use super::{normalize_git_path, normalize_windows_namespace_path};

    #[test]
    fn normalize_git_path_replaces_backslashes() {
        assert_eq!(normalize_git_path("foo\\bar\\baz"), "foo/bar/baz");
    }

    #[test]
    fn normalize_windows_namespace_path_strips_drive_prefix() {
        assert_eq!(
            normalize_windows_namespace_path(r"\\?\I:\gpt-projects\json-composer"),
            r"I:\gpt-projects\json-composer"
        );
        assert_eq!(
            normalize_windows_namespace_path("//?/I:/gpt-projects/json-composer"),
            "I:/gpt-projects/json-composer"
        );
    }

    #[test]
    fn normalize_windows_namespace_path_strips_unc_prefix() {
        assert_eq!(
            normalize_windows_namespace_path(r"\\?\UNC\SERVER\Share\Repo"),
            r"\\SERVER\Share\Repo"
        );
        assert_eq!(
            normalize_windows_namespace_path("//?/UNC/SERVER/Share/Repo"),
            "//SERVER/Share/Repo"
        );
        assert_eq!(
            normalize_windows_namespace_path(r"\\?\unc\SERVER\Share\Repo"),
            r"\\SERVER\Share\Repo"
        );
        assert_eq!(
            normalize_windows_namespace_path("//?/unc/SERVER/Share/Repo"),
            "//SERVER/Share/Repo"
        );
    }

    #[test]
    fn normalize_windows_namespace_path_preserves_whitespace_for_plain_paths() {
        assert_eq!(
            normalize_windows_namespace_path("  /tmp/workspace  "),
            "  /tmp/workspace  "
        );
    }

    #[test]
    fn normalize_windows_namespace_path_preserves_other_namespace_forms() {
        assert_eq!(
            normalize_windows_namespace_path(
                r"\\?\Volume{01234567-89ab-cdef-0123-456789abcdef}\repo"
            ),
            r"\\?\Volume{01234567-89ab-cdef-0123-456789abcdef}\repo"
        );
        assert_eq!(
            normalize_windows_namespace_path(r"\\.\pipe\agent-monitor"),
            r"\\.\pipe\agent-monitor"
        );
    }
}
