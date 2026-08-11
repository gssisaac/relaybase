import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { formatSenderDisplay, senderInitials } from "./format-sender.ts";

describe("formatSenderDisplay", () => {
  it("prefers the MIME display name when present", () => {
    assert.equal(formatSenderDisplay("Isaac Lee", "isaac@gmail.com"), "Isaac Lee");
  });

  it("falls back to the address when no display name", () => {
    assert.equal(formatSenderDisplay(null, "isaac@strum.us"), "isaac@strum.us");
    assert.equal(formatSenderDisplay("", "isaac@strum.us"), "isaac@strum.us");
    assert.equal(formatSenderDisplay(undefined, "isaac@strum.us"), "isaac@strum.us");
  });

  it("collapses VERP bounce envelope addresses to a friendly label", () => {
    assert.equal(
      formatSenderDisplay(null, "bounce+ef499c.63af5d-isaac=wedesk.so@example.com"),
      "Mail Delivery System",
    );
    assert.equal(
      formatSenderDisplay(null, "bounces+41265761-ad21-isaac=wedesk.so@example.com"),
      "Mail Delivery System",
    );
    assert.equal(
      formatSenderDisplay(null, "msprvs1=20681k-oj8lAL=bounces-274689@example.com"),
      "Mail Delivery System",
    );
  });

  it("collapses mailer-daemon / postmaster addresses", () => {
    assert.equal(
      formatSenderDisplay(null, "mailer-daemon@amazonses.com"),
      "Mail Delivery System",
    );
    assert.equal(
      formatSenderDisplay(null, "bounces@cf-bounce.cloudflare.net"),
      "Mail Delivery System",
    );
  });

  it("returns Unknown sender when nothing is available", () => {
    assert.equal(formatSenderDisplay(null, ""), "Unknown sender");
    assert.equal(formatSenderDisplay(undefined, undefined), "Unknown sender");
  });
});

describe("senderInitials", () => {
  it("derives initials from a display name", () => {
    assert.equal(senderInitials("Isaac Lee", "isaac@gmail.com"), "IL");
  });

  it("derives initials from the local part when no name", () => {
    assert.equal(senderInitials(null, "isaac@strum.us"), "IS");
  });

  it("returns ? for empty input", () => {
    assert.equal(senderInitials(null, ""), "?");
  });
});
