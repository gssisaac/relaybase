import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isValidPasstokenFormat,
  normalizePasstokenInput,
  passtokenBackupFileContents,
} from "./normalize-passtoken.ts";

describe("passtokenBackupFileContents", () => {
  it("is the raw token only — no comments, Worker URL, or PASSTOKEN=", () => {
    const token = "rb_pass_ZaZYDbQbSv64MOYA_h_uQD8PTm4FomV-I6aiae2WYig";
    const body = passtokenBackupFileContents(`  ${token}  `);
    assert.equal(body, token);
    assert.equal(body.includes("PASSTOKEN="), false);
    assert.equal(body.includes("#"), false);
    assert.equal(body.includes("\n"), false);
    assert.equal(body.includes("workers.dev"), false);
  });
});

describe("normalizePasstokenInput", () => {
  it("passes through a raw rb_pass token", () => {
    const token = "rb_pass_abc123XYZ-_";
    assert.equal(normalizePasstokenInput(token), token);
    assert.equal(isValidPasstokenFormat(token), true);
  });

  it("strips PASSTOKEN= from download file lines", () => {
    const raw = "PASSTOKEN=rb_pass_abc123XYZ-_";
    assert.equal(normalizePasstokenInput(raw), "rb_pass_abc123XYZ-_");
    assert.equal(isValidPasstokenFormat(raw), true);
  });

  it("extracts the token from a legacy comment-wrapped download", () => {
    const token = "rb_pass_abc123XYZ-_abcdefghij";
    const raw = [
      "# Relaybase owner passtoken — save this file securely",
      "# Worker URL: https://relaybase-api.example.workers.dev",
      "",
      `PASSTOKEN=${token}`,
      "",
    ].join("\n");
    assert.equal(normalizePasstokenInput(raw), token);
  });

  it("strips surrounding quotes and whitespace", () => {
    assert.equal(
      normalizePasstokenInput('  "rb_pass_abc123XYZ-_"  '),
      "rb_pass_abc123XYZ-_",
    );
  });

  it("rejects admin-token shaped values", () => {
    assert.equal(isValidPasstokenFormat("rb-auth-legacy-token"), false);
  });
});
