import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ONBOARDING_STEPS } from "./onboarding-types.ts";
import { isRestorablePath } from "@/lib/navigation/sidebar-paths.ts";

describe("ONBOARDING_STEPS", () => {
  it("contains 4 sequential steps with required initial sequence", () => {
    assert.equal(ONBOARDING_STEPS.length, 4);
    assert.deepEqual(
      ONBOARDING_STEPS.map((s) => s.id),
      ["email-api", "domain", "account", "complete"],
    );
    assert.deepEqual(
      ONBOARDING_STEPS.map((s) => s.stepNumber),
      [1, 2, 3, 4],
    );
  });
});

describe("onboarding path restrictions", () => {
  it("never restores /onboarding as a session landing path", () => {
    assert.equal(isRestorablePath("/onboarding", "dashboard"), false);
    assert.equal(isRestorablePath("/onboarding", "email"), false);
    assert.equal(isRestorablePath("/onboarding", "studio"), false);
  });
});
