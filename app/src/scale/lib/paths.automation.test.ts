import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  automationContentEditHref,
  automationDetailFromPathname,
  automationDetailHref,
  automationTabFromPathname,
} from "./paths.ts";

describe("automationDetailHref", () => {
  it("writes nested tab routes", () => {
    assert.equal(
      automationDetailHref("automation_abc", "settings"),
      "/scale/automations/automation_abc/settings",
    );
    assert.equal(
      automationDetailHref("automation_abc", "preview"),
      "/scale/automations/automation_abc/preview",
    );
  });

  it("defaults landing tab from status when tab is omitted", () => {
    assert.equal(
      automationDetailHref("automation_abc", undefined, "draft"),
      "/scale/automations/automation_abc/preview",
    );
    assert.equal(
      automationDetailHref("automation_abc", undefined, "active"),
      "/scale/automations/automation_abc/preview",
    );
  });

  it("keeps the current tab when switching automations", () => {
    const tab = automationTabFromPathname("/scale/automations/automation_a/settings");
    assert.equal(tab, "settings");
    assert.equal(
      automationDetailHref("automation_b", tab),
      "/scale/automations/automation_b/settings",
    );
  });
});

describe("automationContentEditHref", () => {
  it("nests the editor under the automation id", () => {
    assert.equal(
      automationContentEditHref("automation_abc"),
      "/scale/automations/automation_abc/edit",
    );
  });
});

describe("automationDetailFromPathname", () => {
  it("parses id and tab", () => {
    assert.deepEqual(automationDetailFromPathname("/scale/automations/automation_abc/trigger"), {
      automationId: "automation_abc",
      tab: "trigger",
      isEdit: false,
    });
  });

  it("treats /edit as the content editor", () => {
    assert.deepEqual(automationDetailFromPathname("/scale/automations/automation_abc/edit"), {
      automationId: "automation_abc",
      tab: "preview",
      isEdit: true,
    });
  });

  it("ignores the list and legacy edit roots", () => {
    assert.equal(automationDetailFromPathname("/scale/automations"), null);
    assert.equal(automationDetailFromPathname("/scale/automations/edit"), null);
  });
});
