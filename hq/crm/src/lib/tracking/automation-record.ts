import { store } from "../../db/store";
import { newId } from "../shared/ids";
import { rollupAutomationStatsFromSends } from "../automations/stats";

function refreshAutomationStats(draft: import("../../db/types").CrmDataStore, automationId: string) {
  const aIdx = draft.automations.findIndex((a) => a.id === automationId);
  if (aIdx < 0) return;
  const automation = draft.automations[aIdx]!;
  const sends = draft.automationSends.filter((s) => s.automationId === automationId);
  const events = draft.automationTrackingEvents.filter((e) => e.automationId === automationId);
  const rolled = rollupAutomationStatsFromSends(sends, events);
  draft.automations[aIdx] = {
    ...automation,
    stats: {
      ...automation.stats,
      ...rolled,
    },
  };
}

export function recordAutomationTrackingOpen(automationId: string, automationSendId: string) {
  try {
    const send = store
      .read()
      .automationSends.find((s) => s.id === automationSendId && s.automationId === automationId);
    if (!send) return;
    const now = new Date().toISOString();
    store.update((draft) => {
      const idx = draft.automationSends.findIndex((s) => s.id === automationSendId);
      if (idx < 0) return;
      draft.automationSends[idx] = {
        ...draft.automationSends[idx]!,
        openedAt: draft.automationSends[idx]!.openedAt ?? now,
        openCount: draft.automationSends[idx]!.openCount + 1,
      };
      draft.automationTrackingEvents.push({
        id: newId("autotrack"),
        automationId,
        automationSendId,
        memberEmail: send.email,
        type: "open",
        url: null,
        reason: null,
        occurredAt: now,
      });
      refreshAutomationStats(draft, automationId);
    });
  } catch (err) {
    console.error("[crm-automation-tracking] failed to record open", err);
  }
}

export function recordAutomationTrackingClick(
  automationId: string,
  automationSendId: string,
  url: string,
) {
  try {
    const send = store
      .read()
      .automationSends.find((s) => s.id === automationSendId && s.automationId === automationId);
    if (!send) return;
    const now = new Date().toISOString();
    store.update((draft) => {
      const idx = draft.automationSends.findIndex((s) => s.id === automationSendId);
      if (idx < 0) return;
      draft.automationSends[idx] = {
        ...draft.automationSends[idx]!,
        clickedAt: draft.automationSends[idx]!.clickedAt ?? now,
        clickCount: draft.automationSends[idx]!.clickCount + 1,
      };
      draft.automationTrackingEvents.push({
        id: newId("autotrack"),
        automationId,
        automationSendId,
        memberEmail: send.email,
        type: "click",
        url,
        reason: null,
        occurredAt: now,
      });
      refreshAutomationStats(draft, automationId);
    });
  } catch (err) {
    console.error("[crm-automation-tracking] failed to record click", err);
  }
}
