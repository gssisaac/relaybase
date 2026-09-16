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
      shouldProxyRequestToScale("/scale/unsubscribe/newsletter_x/tok_y", "GET", headers()),
      true,
    );
  });

  it("serves newsletter UI without API header", () => {
    assert.equal(shouldProxyRequestToScale("/scale/newsletters", "GET", headers()), false);
    assert.equal(
      shouldProxyRequestToScale("/scale/newsletters/in-progress", "GET", headers()),
      false,
    );
  });

  it("proxies newsletter API list with Scale API header", () => {
    assert.equal(shouldProxyRequestToScale("/scale/newsletters", "GET", headers(true)), true);
    assert.equal(
      shouldProxyRequestToScale("/scale/newsletters/in-progress", "GET", headers(true)),
      true,
    );
  });

  it("serves overview UI without API header", () => {
    assert.equal(shouldProxyRequestToScale("/scale/overview", "GET", headers()), false);
  });

  it("proxies overview JSON with Scale API header", () => {
    assert.equal(shouldProxyRequestToScale("/scale/overview", "GET", headers(true)), true);
  });

  it("proxies newsletter detail JSON", () => {
    assert.equal(
      shouldProxyRequestToScale("/scale/newsletters/newsletter_abc", "GET", headers(true)),
      true,
    );
  });

  it("serves trigger content edit UI without API header", () => {
    assert.equal(shouldProxyRequestToScale("/scale/triggers", "GET", headers()), false);
    assert.equal(shouldProxyRequestToScale("/scale/triggers/edit", "GET", headers()), false);
    assert.equal(
      shouldProxyRequestToScale("/scale/triggers/trigger-stats", "GET", headers()),
      false,
    );
  });

  it("proxies trigger stats overview JSON with Scale API header", () => {
    assert.equal(shouldProxyRequestToScale("/scale/triggers/stats", "GET", headers()), false);
    assert.equal(
      shouldProxyRequestToScale("/scale/triggers/stats", "GET", headers(true)),
      true,
    );
  });

  it("serves trigger detail tab UI without API header", () => {
    assert.equal(
      shouldProxyRequestToScale("/scale/triggers/trigger_abc/settings", "GET", headers()),
      false,
    );
    assert.equal(
      shouldProxyRequestToScale("/scale/triggers/trigger_abc/preview", "GET", headers()),
      false,
    );
    assert.equal(
      shouldProxyRequestToScale("/scale/triggers/trigger_abc/stats", "GET", headers()),
      false,
    );
    assert.equal(
      shouldProxyRequestToScale("/scale/triggers/trigger_abc", "GET", headers()),
      false,
    );
    assert.equal(
      shouldProxyRequestToScale("/scale/triggers/trigger_abc/settings", "HEAD", headers()),
      false,
    );
  });

  it("proxies trigger API detail with Scale API header", () => {
    assert.equal(
      shouldProxyRequestToScale("/scale/triggers/trigger_abc", "GET", headers(true)),
      true,
    );
    assert.equal(
      shouldProxyRequestToScale("/scale/triggers/trigger_abc/stats", "GET", headers(true)),
      true,
    );
  });

  it("proxies trigger activity API without treating it as a UI tab", () => {
    assert.equal(
      shouldProxyRequestToScale("/scale/triggers/trigger_abc/activity", "GET", headers()),
      true,
    );
  });

  it("serves layouts UI without API header", () => {
    assert.equal(shouldProxyRequestToScale("/scale/layouts", "GET", headers()), false);
  });

  it("proxies layout API with Scale API header", () => {
    assert.equal(shouldProxyRequestToScale("/scale/layouts", "GET", headers(true)), true);
    assert.equal(
      shouldProxyRequestToScale("/scale/layouts/tpl-minimal", "GET", headers(true)),
      true,
    );
  });

  it("serves message templates UI without API header", () => {
    assert.equal(shouldProxyRequestToScale("/scale/templates", "GET", headers()), false);
  });

  it("proxies message template detail with Scale API header", () => {
    assert.equal(
      shouldProxyRequestToScale("/scale/templates/tmpl_abc", "GET", headers(true)),
      true,
    );
  });
});
