import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ONBOARDING_PATH } from "./needs-cloud-onboarding.ts";

describe("ONBOARDING_PATH", () => {
  it("is the auth onboarding route", () => {
    assert.equal(ONBOARDING_PATH, "/onboarding");
  });
});
