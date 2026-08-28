use crate::worker::DEFAULT_SCRIPT;

use super::constants::WIPE_PHRASE_DELETE_ME;
use super::types::{InstallDecision, InstallResourceProbe};

/// `DELETE ME`, the Worker script name, or any of `resource_names`.
pub fn wipe_confirmation_allows(phrase: Option<&str>, resource_names: &[&str]) -> bool {
    let Some(p) = phrase.map(str::trim).filter(|s| !s.is_empty()) else {
        return false;
    };
    p == WIPE_PHRASE_DELETE_ME
        || p == DEFAULT_SCRIPT
        || resource_names.iter().any(|n| *n == p)
}

pub(crate) fn assert_wipe_phrase(phrase: Option<&str>, resource_names: &[&str]) -> Result<(), String> {
    if wipe_confirmation_allows(phrase, resource_names) {
        Ok(())
    } else {
        Err(format!(
            "{} already has data. Type DELETE ME or the resource name to permanently delete it.",
            resource_names.join(", ")
        ))
    }
}

fn occupied_wipe_refused(occupied: &[&InstallResourceProbe]) -> String {
    let summary = occupied
        .iter()
        .map(|r| {
            if r.kind == "r2" {
                let n = r.object_count.unwrap_or(0);
                let plus = if r.truncated { "+" } else { "" };
                format!("{} ({n}{plus} objects)", r.name)
            } else {
                let n = r.row_count.unwrap_or(0);
                let plus = if r.truncated { "+" } else { "" };
                format!("{} ({n}{plus} rows)", r.name)
            }
        })
        .collect::<Vec<_>>()
        .join(", ");
    format!(
        "These resources already have data ({summary}). Type DELETE ME or the resource name to permanently delete them."
    )
}

pub(crate) fn assert_occupied_wipe_allowed(
    occupied: &[&InstallResourceProbe],
    wipe_confirmation: Option<&str>,
) -> Result<(), String> {
    if occupied.is_empty() {
        return Ok(());
    }
    let names: Vec<&str> = occupied.iter().map(|r| r.name.as_str()).collect();
    if wipe_confirmation_allows(wipe_confirmation, &names) {
        Ok(())
    } else {
        Err(occupied_wipe_refused(occupied))
    }
}

#[derive(Default)]
pub(crate) struct InstallPlan {
    pub(crate) reinstall_worker: bool,
    pub(crate) reinstall_r2: bool,
    pub(crate) reinstall_d1: Vec<String>,
}

impl InstallPlan {
    pub(crate) fn from_decisions(decisions: &[InstallDecision]) -> Self {
        let mut plan = Self::default();
        for d in decisions {
            if d.action != "reinstall" {
                continue;
            }
            match d.kind.as_str() {
                "worker" => plan.reinstall_worker = true,
                "r2" => plan.reinstall_r2 = true,
                "d1" => plan.reinstall_d1.push(d.name.clone()),
                _ => {}
            }
        }
        plan
    }

    pub(crate) fn should_reinstall_d1(&self, name: &str) -> bool {
        self.reinstall_d1.iter().any(|n| n == name)
    }
}

#[cfg(test)]
mod wipe_phrase_tests {
    use crate::worker::DEFAULT_SCRIPT;

    use super::wipe_confirmation_allows;
    use super::super::constants::WIPE_PHRASE_DELETE_ME;

    #[test]
    fn delete_me_allows_any_resource() {
        assert!(wipe_confirmation_allows(
            Some(WIPE_PHRASE_DELETE_ME),
            &["relaybase-mailbox"]
        ));
    }

    #[test]
    fn project_name_allows() {
        assert!(wipe_confirmation_allows(
            Some(DEFAULT_SCRIPT),
            &["relaybase-mailbox"]
        ));
    }

    #[test]
    fn matching_resource_name_allows() {
        assert!(wipe_confirmation_allows(
            Some("relaybase-mailbox"),
            &["relaybase-mailbox"]
        ));
    }

    #[test]
    fn empty_or_wrong_phrase_refuses() {
        assert!(!wipe_confirmation_allows(None, &["relaybase-mailbox"]));
        assert!(!wipe_confirmation_allows(Some(""), &["relaybase-mailbox"]));
        assert!(!wipe_confirmation_allows(
            Some("delete me"),
            &["relaybase-mailbox"]
        ));
        assert!(!wipe_confirmation_allows(
            Some("relaybase-db"),
            &["relaybase-mailbox"]
        ));
    }
}
