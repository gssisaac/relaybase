import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  isEmailApiNotConfiguredError,
  isEmailRoutingPermissionError,
} from "./email-api-errors.ts";

describe("isEmailRoutingPermissionError", () => {
  it("matches Cloudflare 10000 Authentication error on email/routing", () => {
    const err =
      "Could not configure inbox for support@hapfam.com: Cloudflare API: [10000] Authentication error API: GET /zones/8ec1246f49978407113fbca7ef2be8f8/email/routing";
    assert.equal(isEmailRoutingPermissionError(err), true);
    assert.equal(isEmailApiNotConfiguredError(err), true);
  });

  it("matches structured cf_token_permission_missing code", () => {
    const err = "Failed to update inbound routing (cf_token_permission_missing)";
    assert.equal(isEmailRoutingPermissionError(err), true);
    assert.equal(isEmailApiNotConfiguredError(err), true);
  });

  it("matches generic unconfigured email API errors in isEmailApiNotConfiguredError", () => {
    assert.equal(
      isEmailApiNotConfiguredError("Cloudflare API is not configured on this Worker"),
      true,
    );
    assert.equal(
      isEmailApiNotConfiguredError("add a cf_api_token secret"),
      true,
    );
  });

  it("does not match unrelated generic errors", () => {
    assert.equal(isEmailRoutingPermissionError("Network timeout"), false);
    assert.equal(isEmailApiNotConfiguredError("Network timeout"), false);
  });
});
