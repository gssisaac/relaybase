import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { CRM_API_REQUEST_HEADER } from "./crm-origin.ts";
import { shouldProxyRequestToCrm } from "./crm-proxy-policy.ts";

function headers(api = false): Headers {
  const h = new Headers();
  if (api) h.set(CRM_API_REQUEST_HEADER, "1");
  return h;
}

describe("shouldProxyRequestToCrm", () => {
  it("proxies public unsubscribe", () => {
    assert.equal(
      shouldProxyRequestToCrm("/crm/unsubscribe/broadcast_x/tok_y", "GET", headers()),
      true,
    );
  });

  it("serves broadcast UI without API header", () => {
    assert.equal(shouldProxyRequestToCrm("/crm/broadcasts", "GET", headers()), false);
    assert.equal(
      shouldProxyRequestToCrm("/crm/broadcasts/in-progress", "GET", headers()),
      false,
    );
  });

  it("proxies broadcast API list with CRM API header", () => {
    assert.equal(shouldProxyRequestToCrm("/crm/broadcasts", "GET", headers(true)), true);
    assert.equal(
      shouldProxyRequestToCrm("/crm/broadcasts/in-progress", "GET", headers(true)),
      true,
    );
  });

  it("proxies broadcast detail JSON", () => {
    assert.equal(
      shouldProxyRequestToCrm("/crm/broadcasts/broadcast_abc", "GET", headers(true)),
      true,
    );
  });
});
