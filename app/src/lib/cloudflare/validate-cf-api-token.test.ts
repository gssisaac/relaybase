import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { cfVerifyTokenErrorMessage, validateCfApiTokenInput } from "./validate-cf-api-token.ts";

describe("validateCfApiTokenInput", () => {
  it("rejects dashboard URLs mistaken for tokens", () => {
    const result = validateCfApiTokenInput("https://relaybase.email/onboarding");
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.message, /URL/i);
  });

  it("accepts long printable ASCII token strings", () => {
    const token = "unit-test-placeholder-token-not-a-real-secret";
    const result = validateCfApiTokenInput(token);
    assert.deepEqual(result, { ok: true, token });
  });
});

describe("cfVerifyTokenErrorMessage", () => {
  it("maps Cloudflare 6111 to a clear message", () => {
    const msg = cfVerifyTokenErrorMessage({
      errors: [{ code: 6111, message: "Invalid format for Authorization header" }],
    });
    assert.match(msg ?? "", /not a valid Cloudflare API token/i);
  });
});
