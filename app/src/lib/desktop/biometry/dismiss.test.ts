import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isSystemCanceledBiometry,
  isUserDismissedBiometry,
} from "./dismiss.ts";

describe("isUserDismissedBiometry", () => {
  it("treats plugin cancel codes as a normal dismiss", () => {
    assert.equal(isUserDismissedBiometry({ errorCode: "userCancel" }), true);
    assert.equal(isUserDismissedBiometry({ errorCode: "systemCancel" }), true);
    assert.equal(
      isUserDismissedBiometry("[UserCancel] - The user cancelled the authentication"),
      true,
    );
    assert.equal(
      isUserDismissedBiometry("[systemCancel] - Authentication canceled."),
      true,
    );
    assert.equal(isUserDismissedBiometry(new Error("userCancel")), true);
  });

  it("detects launch-time systemCancel", () => {
    assert.equal(
      isSystemCanceledBiometry("[systemCancel] - Authentication canceled."),
      true,
    );
    assert.equal(isSystemCanceledBiometry("userCancel"), false);
  });

  it("does not hide real unlock failures", () => {
    assert.equal(isUserDismissedBiometry("Biometry is locked out"), false);
    assert.equal(isUserDismissedBiometry("Invalid passtoken"), false);
    assert.equal(isUserDismissedBiometry(null), false);
  });
});
