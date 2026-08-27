import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildDefaultWorkerUrl,
  isValidWorkerUrl,
  normalizeWorkerUrl,
  parseDefaultWorkerSubdomain,
} from "./worker-url.ts";

describe("worker-url", () => {
  it("normalizes trailing slashes", () => {
    assert.equal(
      normalizeWorkerUrl("https://relaybase-api.foo.workers.dev/"),
      "https://relaybase-api.foo.workers.dev",
    );
  });

  it("builds the default workers.dev URL from an account slug", () => {
    assert.equal(
      buildDefaultWorkerUrl("GssIsaac"),
      "https://relaybase-api.gssisaac.workers.dev",
    );
    assert.equal(buildDefaultWorkerUrl("  my-account  "), "https://relaybase-api.my-account.workers.dev");
  });

  it("parses subdomain from default URL pattern", () => {
    assert.equal(
      parseDefaultWorkerSubdomain("https://relaybase-api.gssisaac.workers.dev"),
      "gssisaac",
    );
    assert.equal(parseDefaultWorkerSubdomain("https://custom.example.com"), null);
  });

  it("validates https Worker URLs", () => {
    assert.equal(isValidWorkerUrl("https://relaybase-api.foo.workers.dev"), true);
    assert.equal(isValidWorkerUrl("http://relaybase-api.foo.workers.dev"), false);
    assert.equal(isValidWorkerUrl(""), false);
  });
});
