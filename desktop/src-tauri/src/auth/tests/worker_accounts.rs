use crate::auth::worker_accounts::{
    normalize_worker_url, passtoken_account, session_account, worker_urls_equal,
};

#[test]
fn normalize_strips_trailing_slash() {
    assert_eq!(
        normalize_worker_url(" https://relaybase-api.gssisaac.workers.dev/ "),
        "https://relaybase-api.gssisaac.workers.dev"
    );
}

#[test]
fn account_names_are_scoped_by_url() {
    let a = "https://relaybase-api.gssisaac.workers.dev";
    let b = "https://relaybase-api.kembo.workers.dev";
    assert_eq!(
        passtoken_account(a),
        "owner-passtoken:https://relaybase-api.gssisaac.workers.dev"
    );
    assert_ne!(passtoken_account(a), passtoken_account(b));
    assert_ne!(session_account(a), session_account(b));
    assert_eq!(passtoken_account(&format!("{a}/")), passtoken_account(a));
}

#[test]
fn urls_compare_case_insensitively() {
    assert!(worker_urls_equal(
        "https://Relaybase-Api.Gssisaac.workers.dev/",
        "https://relaybase-api.gssisaac.workers.dev"
    ));
    assert!(!worker_urls_equal(
        "https://relaybase-api.gssisaac.workers.dev",
        "https://relaybase-api.kembo.workers.dev"
    ));
}
