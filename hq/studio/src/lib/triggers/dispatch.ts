import { studioService } from "@services/studio-service";
import type { Trigger, TriggerSend } from "@db/types";
import { requireMessage } from "@lib/messages/resolve";
import { sendMail } from "@lib/mail/sender";
import { STUDIO_PUBLIC_BASE_URL } from "@lib/shared/studio-url";
import { newId, newToken } from "@lib/shared/ids";
import {
  applyTemplateVariablesToPlainText,
  resolveTemplateVariableDefaults,
} from "@lib/templates/variable-schema";
import { applyAutomationRecipientMergeTags, applyTriggerMergeTags } from "@lib/triggers/merge-tags";
import { triggerSendMailOptions, buildTriggerListUnsubscribeUrl, renderTriggerForSend } from "@lib/triggers/render";
import { getTriggerLayoutHtml, getTriggerLayoutSchema } from "@lib/triggers/serialize";
import { rollupTriggerStatsFromSends } from "@lib/triggers/stats";

export async function dispatchTriggerSend(
  automation: Trigger,
  send: TriggerSend,
  payload: Record<string, unknown>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const message = requireMessage(studioService.read(), automation.messageId);
  const layoutId = message.layoutId ?? "tpl-minimal";
  const templateHtml =
    getTriggerLayoutHtml(layoutId) ?? getTriggerLayoutHtml("tpl-minimal") ?? "{{content}}";

  const html = renderTriggerForSend({
    automation,
    triggerSendId: send.id,
    templateHtml,
    templateVariablesSchema: getTriggerLayoutSchema(layoutId),
    recipient: { email: send.email, name: send.name },
    payload,
    studioBaseUrl: STUDIO_PUBLIC_BASE_URL,
  });

  const from = automation.fromEmail?.trim() ?? "";
  const layoutSchema = getTriggerLayoutSchema(layoutId);
  const resolvedTemplateVariables = resolveTemplateVariableDefaults({
    schema: layoutSchema,
    values: message.templateVariables,
  });
  const subjectWithLayoutVars = applyTemplateVariablesToPlainText(
    message.subject,
    layoutSchema,
    resolvedTemplateVariables,
    { broadcastId: automation.id, studioBaseUrl: STUDIO_PUBLIC_BASE_URL },
  );
  const subject = applySubjectMergeTags(subjectWithLayoutVars, send, payload);

  const mailOpts = triggerSendMailOptions(automation);
  let listUnsubscribeUrl: string | undefined;
  if (mailOpts.includeListUnsubscribe) {
    listUnsubscribeUrl = buildTriggerListUnsubscribeUrl(
      STUDIO_PUBLIC_BASE_URL,
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
    studioService.update((draft) => {
      const sIdx = draft.triggerSends.findIndex((s) => s.id === send.id);
      if (sIdx >= 0) {
        draft.triggerSends[sIdx] = {
          ...draft.triggerSends[sIdx]!,
          status: "failed",
          errorMessage: result.error,
        };
      }
      const aIdx = draft.triggers.findIndex((a) => a.id === automation.id);
      if (aIdx >= 0) {
        const stats = draft.triggers[aIdx]!.stats;
        draft.triggers[aIdx] = {
          ...draft.triggers[aIdx]!,
          stats: { ...stats, failed: stats.failed + 1 },
          updatedAt: now,
        };
      }
    });
    return result;
  }

  studioService.update((draft) => {
    const sIdx = draft.triggerSends.findIndex((s) => s.id === send.id);
    if (sIdx >= 0) {
      draft.triggerSends[sIdx] = {
        ...draft.triggerSends[sIdx]!,
        status: "delivered",
        sentAt: now,
        deliveredAt: now,
        errorMessage: null,
      };
    }
    const aIdx = draft.triggers.findIndex((a) => a.id === automation.id);
    if (aIdx >= 0) {
      const automationRow = draft.triggers[aIdx]!;
      const sends = draft.triggerSends.filter((s) => s.triggerId === automation.id);
      const events = draft.triggerTrackingEvents.filter((e) => e.triggerId === automation.id);
      const rolled = rollupTriggerStatsFromSends(sends, events);
      draft.triggers[aIdx] = {
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
  send: TriggerSend,
  payload: Record<string, unknown>,
): string {
  let out = applyAutomationRecipientMergeTags(subject, send);
  out = applyTriggerMergeTags(out, payload);
  return out.trim();
}
