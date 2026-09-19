import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  clampSidebarWidth,
  parseSidebarWidth,
  SIDEBAR_WIDTH,
} from "./sidebar-width.ts";

describe("clampSidebarWidth", () => {
  it("clamps to configured bounds", () => {
    assert.equal(clampSidebarWidth(100), SIDEBAR_WIDTH.min);
    assert.equal(clampSidebarWidth(999), SIDEBAR_WIDTH.max);
    assert.equal(clampSidebarWidth(240.6), 241);
  });
});

describe("parseSidebarWidth", () => {
  it("accepts finite numbers", () => {
    assert.equal(parseSidebarWidth(240), 240);
  });

  it("rejects non-numbers", () => {
    assert.equal(parseSidebarWidth("240"), null);
    assert.equal(parseSidebarWidth(null), null);
  });
});
