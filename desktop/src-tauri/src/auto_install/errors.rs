pub(crate) fn parse_digits_after(hay: &str, needle: &str) -> Option<u32> {
    let lower = hay.to_ascii_lowercase();
    let idx = lower.find(needle)?;
    let rest = hay[idx + needle.len()..].trim_start_matches([' ', ':', '"', '=']);
    let digits: String = rest.chars().take_while(|c| c.is_ascii_digit()).collect();
    if digits.len() >= 3 && digits.len() <= 5 {
        digits.parse().ok()
    } else {
        None
    }
}

pub(crate) fn extract_cf_error_code(text: &str) -> Option<u32> {
    parse_digits_after(text, "error code")
        .or_else(|| parse_digits_after(text, "\"code\""))
        .or_else(|| parse_digits_after(text, "code:"))
}

fn cf_worker_code_hint(code: u32) -> Option<&'static str> {
    Some(match code {
        1101 => {
            "Cloudflare 1101: the Worker threw a JavaScript exception. Open Cloudflare → Workers → relaybase-api → Logs for the stack."
        }
        1102 => {
            "Cloudflare 1102: the Worker exceeded its CPU time limit on this request."
        }
        1103 => {
            "Cloudflare 1103: this account's Workers runtime needs Cloudflare Support."
        }
        1104 => {
            "Cloudflare 1104: the runtime cancelled this Worker request (startup/isolate, not a Relaybase version mismatch). Common right after deploy — wait and retry."
        }
        1027 => "Cloudflare 1027: this account hit the Workers free-tier daily request limit.",
        1042 => {
            "Cloudflare 1042: a Worker-to-Worker fetch was blocked. Retry after deploy usually works."
        }
        1015 => "Cloudflare 1015: rate limited. Wait a moment and retry.",
        _ => return None,
    })
}

pub(crate) fn format_worker_http_error(
    endpoint: &str,
    status: impl std::fmt::Display,
    body: &str,
) -> String {
    let trimmed = body.trim();
    let json: Option<serde_json::Value> = serde_json::from_str(trimmed).ok();
    let json_line = json.as_ref().and_then(|v| {
        let err = v.get("error").and_then(|x| x.as_str()).unwrap_or("").trim();
        let det = v.get("detail").and_then(|x| x.as_str()).unwrap_or("").trim();
        if err.is_empty() && det.is_empty() {
            None
        } else if det.is_empty() {
            Some(err.to_string())
        } else if err.is_empty() {
            Some(det.to_string())
        } else {
            Some(format!("{err} — {det}"))
        }
    });
    let code = extract_cf_error_code(trimmed);
    let hint = code.and_then(cf_worker_code_hint);
    let mut parts = vec![format!("{endpoint} returned {status}")];
    if let Some(line) = json_line {
        parts.push(line);
    } else if !trimmed.is_empty() {
        let excerpt: String = trimmed.chars().take(280).collect();
        parts.push(excerpt);
    }
    if let Some(h) = hint {
        parts.push(h.to_string());
    } else if let Some(c) = code {
        parts.push(format!(
            "Cloudflare error code {c}. This is a Workers runtime / edge error, not a Relaybase version label."
        ));
    }
    parts.join("\n")
}

pub(crate) fn explain_init_db_failure(e: &str) -> String {
    if let Some(hint) = extract_cf_error_code(e).and_then(cf_worker_code_hint) {
        if e.contains(hint) {
            return e.to_string();
        }
        return format!("{e}\n{hint}");
    }
    if e.contains("owner_config") && e.contains("no such table") {
        return format!(
            "{e}\nThe Worker ran admin auth against D1 before migrations. Re-pack with `pnpm pack:worker-install`, deploy the website, then Try again."
        );
    }
    e.to_string()
}

#[cfg(test)]
mod worker_error_tests {
    use super::{extract_cf_error_code, format_worker_http_error};

    #[test]
    fn parses_plain_error_code() {
        assert_eq!(
            extract_cf_error_code("Internal Server Error: error code: 1104"),
            Some(1104)
        );
        assert_eq!(extract_cf_error_code(r#"{"code":1101,"message":"x"}"#), Some(1101));
    }

    #[test]
    fn formats_1104_with_hint() {
        let msg = format_worker_http_error(
            "init-db",
            500,
            "Internal Server Error\nerror code: 1104",
        );
        assert!(msg.contains("1104"), "{msg}");
        assert!(msg.contains("not a Relaybase version"), "{msg}");
    }
}
