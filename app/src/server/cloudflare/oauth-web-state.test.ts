import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  encodeWebOAuthState,
  isAllowedWebOAuthReturnOrigin,
  parseWebOAuthState,
  WEB_OAUTH_STATE_PREFIX,
} from "./oauth-web-state.ts";

describe("web OAuth state", () => {
  it("round-trips an allowed relaybase.email origin", () => {
    const encoded = encodeWebOAuthState({
      origin: "https://relaybase.email",
      nonce: "125d474a-5b65-4d1a-9830-4a7ad3cd22b4",
    });
    assert.equal(encoded.startsWith(WEB_OAUTH_STATE_PREFIX), true);
    assert.deepEqual(parseWebOAuthState(encoded), {
      origin: "https://relaybase.email",
      nonce: "125d474a-5b65-4d1a-9830-4a7ad3cd22b4",
    });
  });

  it("rejects unknown return origins and desktop UUID state", () => {
    const encoded = encodeWebOAuthState({
      origin: "https://evil.example",
      nonce: "125d474a-5b65-4d1a-9830-4a7ad3cd22b4",
    });
    assert.equal(parseWebOAuthState(encoded), null);
    assert.equal(parseWebOAuthState("125d474a-5b65-4d1a-9830-4a7ad3cd22b4"), null);
    assert.equal(isAllowedWebOAuthReturnOrigin("https://console.relaybase.xyz"), false);
  });
});
