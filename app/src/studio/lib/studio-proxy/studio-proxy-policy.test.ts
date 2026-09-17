import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { STUDIO_API_REQUEST_HEADER } from "../studio-origin/index.ts";
import { shouldProxyRequestToStudio } from "./studio-proxy-policy.ts";

function headers(api = false): Headers {
  const h = new Headers();
  if (api) h.set(STUDIO_API_REQUEST_HEADER, "1");
  return h;
}

describe("shouldProxyRequestToStudio", () => {
  it("proxies public unsubscribe", () => {
    assert.equal(
      shouldProxyRequestToStudio("/studio/unsubscribe/newsletter_x/tok_y", "GET", headers()),
      true,
    );
  });

  it("serves newsletter UI without API header", () => {
    assert.equal(shouldProxyRequestToStudio("/studio/newsletters", "GET", headers()), false);
    assert.equal(
      shouldProxyRequestToStudio("/studio/newsletters/in-progress", "GET", headers()),
      false,
    );
  });

  it("proxies newsletter API list with Studio API header", () => {
    assert.equal(shouldProxyRequestToStudio("/studio/newsletters", "GET", headers(true)), true);
    assert.equal(
      shouldProxyRequestToStudio("/studio/newsletters/in-progress", "GET", headers(true)),
      true,
    );
  });

  it("serves insight UI without API header", () => {
    assert.equal(shouldProxyRequestToStudio("/studio/dashboard", "GET", headers()), false);
    assert.equal(shouldProxyRequestToStudio("/studio/analytics", "GET", headers()), false);
    assert.equal(shouldProxyRequestToStudio("/studio/overview", "GET", headers()), false);
  });

  it("proxies dashboard and analytics JSON with Studio API header", () => {
    assert.equal(shouldProxyRequestToStudio("/studio/dashboard", "GET", headers(true)), true);
    assert.equal(shouldProxyRequestToStudio("/studio/analytics", "GET", headers(true)), true);
  });

  it("serves newsletter detail tab UI without API header", () => {
    assert.equal(
      shouldProxyRequestToStudio("/studio/newsletters/broadcast_sent_july_recap", "GET", headers()),
      false,
    );
    assert.equal(
      shouldProxyRequestToStudio("/studio/newsletters/broadcast_sent_july_recap/stats", "GET", headers()),
      false,
    );
    assert.equal(
      shouldProxyRequestToStudio("/studio/newsletters/broadcast_sent_july_recap/publish", "GET", headers()),
      false,
    );
    assert.equal(
      shouldProxyRequestToStudio("/studio/newsletters/broadcast_sent_july_recap/recipients", "GET", headers()),
      false,
    );
  });

  it("proxies newsletter detail JSON with Studio API header", () => {
    assert.equal(
      shouldProxyRequestToStudio("/studio/newsletters/newsletter_abc", "GET", headers(true)),
      true,
    );
    assert.equal(
      shouldProxyRequestToStudio("/studio/newsletters/newsletter_abc/stats", "GET", headers(true)),
      true,
    );
  });

  it("proxies unknown newsletter subpaths to the API", () => {
    assert.equal(
      shouldProxyRequestToStudio("/studio/newsletters/newsletter_abc/assets", "GET", headers()),
      true,
    );
  });

  it("serves trigger content edit UI without API header", () => {
    assert.equal(shouldProxyRequestToStudio("/studio/triggers", "GET", headers()), false);
    assert.equal(shouldProxyRequestToStudio("/studio/triggers/edit", "GET", headers()), false);
    assert.equal(
      shouldProxyRequestToStudio("/studio/triggers/trigger-stats", "GET", headers()),
      false,
    );
  });

  it("proxies trigger stats overview JSON with Studio API header", () => {
    assert.equal(shouldProxyRequestToStudio("/studio/triggers/stats", "GET", headers()), false);
    assert.equal(
      shouldProxyRequestToStudio("/studio/triggers/stats", "GET", headers(true)),
      true,
    );
  });

  it("serves trigger detail tab UI without API header", () => {
    assert.equal(
      shouldProxyRequestToStudio("/studio/triggers/trigger_abc/config", "GET", headers()),
      false,
    );
    assert.equal(
      shouldProxyRequestToStudio("/studio/triggers/trigger_abc/settings", "GET", headers()),
      false,
    );
    assert.equal(
      shouldProxyRequestToStudio("/studio/triggers/trigger_abc/preview", "GET", headers()),
      false,
    );
    assert.equal(
      shouldProxyRequestToStudio("/studio/triggers/trigger_abc/stats", "GET", headers()),
      false,
    );
    assert.equal(
      shouldProxyRequestToStudio("/studio/triggers/trigger_abc", "GET", headers()),
      false,
    );
    assert.equal(
      shouldProxyRequestToStudio("/studio/triggers/trigger_abc/settings", "HEAD", headers()),
      false,
    );
  });

  it("proxies trigger API detail with Studio API header", () => {
    assert.equal(
      shouldProxyRequestToStudio("/studio/triggers/trigger_abc", "GET", headers(true)),
      true,
    );
    assert.equal(
      shouldProxyRequestToStudio("/studio/triggers/trigger_abc/stats", "GET", headers(true)),
      true,
    );
  });

  it("proxies trigger activity API without treating it as a UI tab", () => {
    assert.equal(
      shouldProxyRequestToStudio("/studio/triggers/trigger_abc/activity", "GET", headers()),
      true,
    );
  });

  it("serves layouts UI without API header", () => {
    assert.equal(shouldProxyRequestToStudio("/studio/layouts", "GET", headers()), false);
  });

  it("proxies layout API with Studio API header", () => {
    assert.equal(shouldProxyRequestToStudio("/studio/layouts", "GET", headers(true)), true);
    assert.equal(
      shouldProxyRequestToStudio("/studio/layouts/tpl-minimal", "GET", headers(true)),
      true,
    );
  });

  it("serves message templates UI without API header", () => {
    assert.equal(shouldProxyRequestToStudio("/studio/templates", "GET", headers()), false);
    assert.equal(shouldProxyRequestToStudio("/studio/templates/edit", "GET", headers()), false);
  });

  it("proxies message template detail with Studio API header", () => {
    assert.equal(
      shouldProxyRequestToStudio("/studio/templates/tmpl_abc", "GET", headers(true)),
      true,
    );
  });

  it("serves messages UI without API header", () => {
    assert.equal(shouldProxyRequestToStudio("/studio/messages", "GET", headers()), false);
  });

  it("proxies message detail with Studio API header", () => {
    assert.equal(
      shouldProxyRequestToStudio("/studio/messages/msg_abc", "GET", headers(true)),
      true,
    );
  });
});
