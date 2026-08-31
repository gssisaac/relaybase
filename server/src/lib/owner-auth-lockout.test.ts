import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { MIGRATIONS } from "../../db/migrations.ts";

describe("owner login lockout removal", () => {
  it("ships a migration that drops lockout columns", () => {
    const drop = MIGRATIONS.find((m) => m.name === "0005_drop_login_lockout");
    assert.ok(drop);
    assert.match(drop!.sql, /DROP COLUMN `failed_attempts`/);
    assert.match(drop!.sql, /DROP COLUMN `locked_until`/);
  });

  it("does not add lockout columns in 0003_owner_login", () => {
    const baseline = MIGRATIONS.find((m) => m.name === "0003_owner_login");
    assert.ok(baseline);
    assert.doesNotMatch(baseline!.sql, /failed_attempts/);
    assert.doesNotMatch(baseline!.sql, /locked_until/);
  });
});
