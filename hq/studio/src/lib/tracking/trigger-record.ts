import { newId } from "@lib/shared/ids";
import { rollupTriggerStatsFromSends } from "@lib/triggers/stats";
import { readStudioDocument, mutateStudioDocument } from "@services/studio/studio-document.service";

function refreshTriggerStats(draft: import("@db/types").StudioDataStore, triggerId: string) {
  const aIdx = draft.triggers.findIndex((a) => a.id === triggerId);
  if (aIdx < 0) return;
  const automation = draft.triggers[aIdx]!;
  const sends = draft.triggerSends.filter((s) => s.triggerId === triggerId);
  const events = draft.triggerTrackingEvents.filter((e) => e.triggerId === triggerId);
  const rolled = rollupTriggerStatsFromSends(sends, events);
  draft.triggers[aIdx] = {
    ...automation,
    stats: {
      ...automation.stats,
      ...rolled,
    },
  };
}

export function recordAutomationTrackingOpen(triggerId: string, triggerSendId: string) {
  try {
    const send = readStudioDocument()
      .triggerSends.find((s) => s.id === triggerSendId && s.triggerId === triggerId);
    if (!send) return;
    const now = new Date().toISOString();
    mutateStudioDocument((draft) => {
      const idx = draft.triggerSends.findIndex((s) => s.id === triggerSendId);
      if (idx < 0) return;
      draft.triggerSends[idx] = {
        ...draft.triggerSends[idx]!,
        openedAt: draft.triggerSends[idx]!.openedAt ?? now,
        openCount: draft.triggerSends[idx]!.openCount + 1,
      };
      draft.triggerTrackingEvents.push({
        id: newId("autotrack"),
        triggerId,
        triggerSendId,
        memberEmail: send.email,
        type: "open",
        url: null,
        reason: null,
        occurredAt: now,
      });
      refreshTriggerStats(draft, triggerId);
    });
  } catch (err) {
    console.error("[studio-automation-tracking] failed to record open", err);
  }
}

export function recordAutomationTrackingClick(
  triggerId: string,
  triggerSendId: string,
  url: string,
) {
  try {
    const send = readStudioDocument()
      .triggerSends.find((s) => s.id === triggerSendId && s.triggerId === triggerId);
    if (!send) return;
    const now = new Date().toISOString();
    mutateStudioDocument((draft) => {
      const idx = draft.triggerSends.findIndex((s) => s.id === triggerSendId);
      if (idx < 0) return;
      draft.triggerSends[idx] = {
        ...draft.triggerSends[idx]!,
        clickedAt: draft.triggerSends[idx]!.clickedAt ?? now,
        clickCount: draft.triggerSends[idx]!.clickCount + 1,
      };
      draft.triggerTrackingEvents.push({
        id: newId("autotrack"),
        triggerId,
        triggerSendId,
        memberEmail: send.email,
        type: "click",
        url,
        reason: null,
        occurredAt: now,
      });
      refreshTriggerStats(draft, triggerId);
    });
  } catch (err) {
    console.error("[studio-automation-tracking] failed to record click", err);
  }
}
