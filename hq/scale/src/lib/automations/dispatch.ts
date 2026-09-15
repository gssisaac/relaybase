import { store } from "../../db/store";
import type { Automation, AutomationSend } from "../../db/types";
import { sendMail } from "../mail/sender";
import { SCALE_PUBLIC_BASE_URL } from "../shared/scale-url";
import { newId, newToken } from "../shared/ids";
import { applyAutomationRecipientMergeTags, applyTriggerMergeTags } from "./merge-tags";
import { automationSendMailOptions, buildAutomationListUnsubscribeUrl, renderAutomationForSend } from "./render";
import { getAutomationTemplateHtml, getAutomationTemplateSchema } from "./serialize";
import { rollupAutomationStatsFromSends } from "./stats";

export async function dispatchAutomationSend(
  automation: Automation,
  send: AutomationSend,
  payload: Record<string, unknown>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const templateHtml =
    getAutomationTemplateHtml(automation.templateId) ??
    getAutomationTemplateHtml("tpl-minimal") ??
    "{{content}}";

  const html = renderAutomationForSend({
    automation,
    automationSendId: send.id,
    templateHtml,
    templateVariablesSchema: getAutomationTemplateSchema(automation.templateId),
    recipient: { email: send.email, name: send.name },
    payload,
    scaleBaseUrl: SCALE_PUBLIC_BASE_URL,
  });

  const from = automation.fromEmail?.trim() ?? "";
  const subject = applySubjectMergeTags(automation.subject, send, payload);

  const mailOpts = automationSendMailOptions(automation);
  let listUnsubscribeUrl: string | undefined;
  if (mailOpts.includeListUnsubscribe) {
    listUnsubscribeUrl = buildAutomationListUnsubscribeUrl(
      SCALE_PUBLIC_BASE_URL,
      automation.id,
      newToken(),
    );
  }

  const result = await sendMail({
    to: send.email,
    from,
    fromName: automation.fromName,
    replyTo: automation.replyTo,
    subject,
    html,
    listUnsubscribeUrl,
  });

  const now = new Date().toISOString();
  if (!result.ok) {
    store.update((draft) => {
      const sIdx = draft.automationSends.findIndex((s) => s.id === send.id);
      if (sIdx >= 0) {
        draft.automationSends[sIdx] = {
          ...draft.automationSends[sIdx]!,
          status: "failed",
          errorMessage: result.error,
        };
      }
      const aIdx = draft.automations.findIndex((a) => a.id === automation.id);
      if (aIdx >= 0) {
        const stats = draft.automations[aIdx]!.stats;
        draft.automations[aIdx] = {
          ...draft.automations[aIdx]!,
          stats: { ...stats, failed: stats.failed + 1 },
          updatedAt: now,
        };
      }
    });
    return result;
  }

  store.update((draft) => {
    const sIdx = draft.automationSends.findIndex((s) => s.id === send.id);
    if (sIdx >= 0) {
      draft.automationSends[sIdx] = {
        ...draft.automationSends[sIdx]!,
        status: "delivered",
        sentAt: now,
        deliveredAt: now,
        errorMessage: null,
      };
    }
    const aIdx = draft.automations.findIndex((a) => a.id === automation.id);
    if (aIdx >= 0) {
      const automationRow = draft.automations[aIdx]!;
      const sends = draft.automationSends.filter((s) => s.automationId === automation.id);
      const events = draft.automationTrackingEvents.filter((e) => e.automationId === automation.id);
      const rolled = rollupAutomationStatsFromSends(sends, events);
      draft.automations[aIdx] = {
        ...automationRow,
        stats: {
          ...automationRow.stats,
          ...rolled,
        },
        lastSentAt: now,
        updatedAt: now,
      };
    }
  });

  return { ok: true };
}

function applySubjectMergeTags(
  subject: string,
  send: AutomationSend,
  payload: Record<string, unknown>,
): string {
  let out = applyAutomationRecipientMergeTags(subject, send);
  out = applyTriggerMergeTags(out, payload);
  return out.trim();
}
