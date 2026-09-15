import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { SCALE_API_REQUEST_HEADER } from "./scale-origin.ts";
import { shouldProxyRequestToScale } from "./scale-proxy-policy.ts";

function headers(api = false): Headers {
  const h = new Headers();
  if (api) h.set(SCALE_API_REQUEST_HEADER, "1");
  return h;
}

describe("shouldProxyRequestToScale", () => {
  it("proxies public unsubscribe", () => {
    assert.equal(
      shouldProxyRequestToScale("/scale/unsubscribe/broadcast_x/tok_y", "GET", headers()),
      true,
    );
  });

  it("serves broadcast UI without API header", () => {
    assert.equal(shouldProxyRequestToScale("/scale/broadcasts", "GET", headers()), false);
    assert.equal(
      shouldProxyRequestToScale("/scale/broadcasts/in-progress", "GET", headers()),
      false,
    );
  });

  it("proxies broadcast API list with Scale API header", () => {
    assert.equal(shouldProxyRequestToScale("/scale/broadcasts", "GET", headers(true)), true);
    assert.equal(
      shouldProxyRequestToScale("/scale/broadcasts/in-progress", "GET", headers(true)),
      true,
    );
  });

  it("serves overview UI without API header", () => {
    assert.equal(shouldProxyRequestToScale("/scale/overview", "GET", headers()), false);
  });

  it("proxies overview JSON with Scale API header", () => {
    assert.equal(shouldProxyRequestToScale("/scale/overview", "GET", headers(true)), true);
  });

  it("proxies broadcast detail JSON", () => {
    assert.equal(
      shouldProxyRequestToScale("/scale/broadcasts/broadcast_abc", "GET", headers(true)),
      true,
    );
  });
});
