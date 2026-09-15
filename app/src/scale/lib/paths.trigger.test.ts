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
      triggerDetailHref("automation_abc", "settings"),
      "/scale/triggers/automation_abc/settings",
    );
    assert.equal(
      triggerDetailHref("automation_abc", "preview"),
      "/scale/triggers/automation_abc/preview",
    );
  });

  it("defaults landing tab from status when tab is omitted", () => {
    assert.equal(
      triggerDetailHref("automation_abc", undefined, "draft"),
      "/scale/triggers/automation_abc/preview",
    );
    assert.equal(
      triggerDetailHref("automation_abc", undefined, "active"),
      "/scale/triggers/automation_abc/preview",
    );
  });

  it("keeps the current tab when switching automations", () => {
    const tab = triggerTabFromPathname("/scale/triggers/automation_a/settings");
    assert.equal(tab, "settings");
    assert.equal(
      triggerDetailHref("automation_b", tab),
      "/scale/triggers/automation_b/settings",
    );
  });
});

describe("triggerContentEditHref", () => {
  it("nests the editor under the automation id", () => {
    assert.equal(
      triggerContentEditHref("automation_abc"),
      "/scale/triggers/automation_abc/edit",
    );
  });
});

describe("triggerDetailFromPathname", () => {
  it("parses id and tab", () => {
    assert.deepEqual(triggerDetailFromPathname("/scale/triggers/automation_abc/trigger"), {
      triggerId: "automation_abc",
      tab: "trigger",
      isEdit: false,
    });
  });

  it("treats /edit as the content editor", () => {
    assert.deepEqual(triggerDetailFromPathname("/scale/triggers/automation_abc/edit"), {
      triggerId: "automation_abc",
      tab: "preview",
      isEdit: true,
    });
  });

  it("ignores the list and legacy edit roots", () => {
    assert.equal(triggerDetailFromPathname("/scale/triggers"), null);
    assert.equal(triggerDetailFromPathname("/scale/triggers/edit"), null);
  });
});
