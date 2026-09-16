import { resolveEmailApiBase } from "@/lib/desktop/api";
import { scaleApi, type TriggerPurpose } from "@/lib/scale/api";

export type HubTemplateSnapshot = {
  subject: string;
  previewText: string;
  bodyMarkdown: string;
  layoutId: string;
  templateVariables: Record<string, string>;
};

export function patchBodyFromHubTemplate(
  hubTemplateId: string,
  snapshot: HubTemplateSnapshot,
): {
  messageTemplateId: string;
  subject: string;
  previewText?: string;
  bodyMarkdown: string;
  layoutId?: string;
  templateVariables: Record<string, string>;
} {
  return {
    messageTemplateId: hubTemplateId,
    subject: snapshot.subject,
    previewText: snapshot.previewText.trim() || undefined,
    bodyMarkdown: snapshot.bodyMarkdown,
    layoutId: snapshot.layoutId || undefined,
    templateVariables: snapshot.templateVariables,
  };
}

export async function createCampaignFromHubTemplate(input: {
  name: string;
  domain: string;
  audienceGroupId: string;
  hubTemplateId: string;
  snapshot: HubTemplateSnapshot;
  fromEmail?: string | null;
}) {
  const workerUrl = resolveEmailApiBase();
  const created = await scaleApi.createCampaign({
    name: input.name.trim(),
    domain: input.domain,
    audienceGroupId: input.audienceGroupId,
    ...(workerUrl ? { workerUrl } : {}),
  });
  return scaleApi.updateCampaign(created.id, {
    ...patchBodyFromHubTemplate(input.hubTemplateId, input.snapshot),
    ...(input.fromEmail?.trim() ? { fromEmail: input.fromEmail.trim() } : {}),
  });
}

export async function createTriggerFromHubTemplate(input: {
  name: string;
  domain: string;
  purpose: TriggerPurpose;
  hubTemplateId: string;
  snapshot: HubTemplateSnapshot;
}) {
  const created = await scaleApi.createTrigger({
    name: input.name.trim(),
    domain: input.domain,
    purpose: input.purpose,
  });
  return scaleApi.updateTrigger(created.id, patchBodyFromHubTemplate(input.hubTemplateId, input.snapshot));
}
