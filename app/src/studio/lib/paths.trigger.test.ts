import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  triggerContentEditHref,
  triggerDetailFromPathname,
  triggerDetailHref,
  triggerTabFromPathname,
} from "./paths.ts";

describe("triggerDetailHref", () => {
  it("writes nested tab routes", () => {
    assert.equal(
      triggerDetailHref("automation_abc", "config"),
      "/studio/triggers/automation_abc/config",
    );
    assert.equal(
      triggerDetailHref("automation_abc", "stats"),
      "/studio/triggers/automation_abc/stats",
    );
  });

  it("defaults landing tab from status when tab is omitted", () => {
    assert.equal(
      triggerDetailHref("automation_abc", undefined, "draft"),
      "/studio/triggers/automation_abc/config",
    );
    assert.equal(
      triggerDetailHref("automation_abc", undefined, "active"),
      "/studio/triggers/automation_abc/config",
    );
  });

  it("keeps the current tab when switching automations", () => {
    const tab = triggerTabFromPathname("/studio/triggers/automation_a/stats");
    assert.equal(tab, "stats");
    assert.equal(
      triggerDetailHref("automation_b", tab),
      "/studio/triggers/automation_b/stats",
    );
  });
});

describe("triggerContentEditHref", () => {
  it("nests the editor under the automation id", () => {
    assert.equal(
      triggerContentEditHref("automation_abc"),
      "/studio/triggers/automation_abc/edit",
    );
  });
});

describe("triggerDetailFromPathname", () => {
  it("parses id and tab", () => {
    assert.deepEqual(triggerDetailFromPathname("/studio/triggers/automation_abc/config"), {
      triggerId: "automation_abc",
      tab: "config",
      isEdit: false,
    });
  });

  it("maps legacy preview to config", () => {
    assert.deepEqual(triggerDetailFromPathname("/studio/triggers/automation_abc/preview"), {
      triggerId: "automation_abc",
      tab: "config",
      isEdit: false,
    });
  });

  it("treats /edit as the content editor", () => {
    assert.deepEqual(triggerDetailFromPathname("/studio/triggers/automation_abc/edit"), {
      triggerId: "automation_abc",
      tab: "config",
      isEdit: true,
    });
  });

  it("ignores the list and legacy edit roots", () => {
    assert.equal(triggerDetailFromPathname("/studio/triggers"), null);
    assert.equal(triggerDetailFromPathname("/studio/triggers/edit"), null);
  });
});
