import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  countNewslettersByFilter,
  matchesNewsletterFilter,
  newsletterFilterLabel,
} from "./newsletter-list-filters";

describe("matchesNewsletterFilter", () => {
  it("keeps scheduled and sending on separate filters", () => {
    assert.equal(matchesNewsletterFilter("scheduled", "scheduled"), true);
    assert.equal(matchesNewsletterFilter("sending", "scheduled"), false);
    assert.equal(matchesNewsletterFilter("sending", "sending"), true);
    assert.equal(matchesNewsletterFilter("scheduled", "sending"), false);
  });

  it("does not mix finished or draft campaigns into in progress", () => {
    assert.equal(matchesNewsletterFilter("draft", "sending"), false);
    assert.equal(matchesNewsletterFilter("sent", "sending"), false);
    assert.equal(matchesNewsletterFilter("failed", "sending"), false);
  });
});

describe("countNewslettersByFilter", () => {
  it("splits scheduled and sending counts", () => {
    const counts = countNewslettersByFilter([
      { status: "draft", listStatus: "active" },
      { status: "scheduled", listStatus: "active" },
      { status: "scheduled", listStatus: "active" },
      { status: "sending", listStatus: "active" },
      { status: "sent", listStatus: "active" },
      { status: "scheduled", listStatus: "archived" },
    ]);

    assert.equal(counts.scheduled, 2);
    assert.equal(counts.sending, 1);
    assert.equal(counts.draft, 1);
    assert.equal(counts.sent, 1);
    assert.equal(counts.archived, 1);
    assert.equal(counts.all, 5);
  });
});

describe("newsletterFilterLabel", () => {
  it("labels sending as In progress", () => {
    assert.equal(newsletterFilterLabel("sending"), "In progress");
    assert.equal(newsletterFilterLabel("scheduled"), "Scheduled");
  });
});
