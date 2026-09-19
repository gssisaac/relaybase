import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { VerifiedAccountsStore } from "./verified-accounts-store.ts";

describe("VerifiedAccountsStore", () => {
  it("derives verification status from Cloudflare destination rows", () => {
    const store = new VerifiedAccountsStore();
    store.destinationsByEmail.set("a@example.com", {
      id: "1",
      email: "a@example.com",
      verified: "2026-01-01T00:00:00Z",
      verifiedAt: "2026-01-01T00:00:00Z",
      createdAt: null,
      modifiedAt: null,
    });
    store.destinationsByEmail.set("b@example.com", {
      id: "2",
      email: "b@example.com",
      verified: null,
      verifiedAt: null,
      createdAt: null,
      modifiedAt: null,
    });

    assert.equal(store.statusForEmail("a@example.com"), "verified");
    assert.equal(store.statusForEmail("b@example.com"), "pending");
    assert.equal(store.statusForEmail("c@example.com"), "unverified");

    const counts = store.countsForEmails(["a@example.com", "b@example.com", "c@example.com"]);
    assert.equal(counts.verified, 1);
    assert.equal(counts.pending, 1);
    assert.equal(counts.unverified, 1);
  });
});
