import { resolveEmailApiBase } from "@/lib/desktop/api";
import { studioApi, type TriggerPurpose } from "@/lib/studio/api";

export type HubTemplateSnapshot = {
  subject: string;
  previewText: string;
  bodyMarkdown: string;
  layoutId: string;
  templateVariables: Record<string, string>;
};

export function patchBodyFromHubTemplate(_hubTemplateId: string, snapshot: HubTemplateSnapshot) {
  return {
    subject: snapshot.subject,
    previewText: snapshot.previewText.trim() || undefined,
    bodyMarkdown: snapshot.bodyMarkdown,
    layoutId: snapshot.layoutId || undefined,
    templateVariables: snapshot.templateVariables,
  };
}

export async function createNewsletterFromHubTemplate(input: {
  name: string;
  domain: string;
  audienceGroupId: string;
  hubTemplateId: string;
  snapshot: HubTemplateSnapshot;
  fromEmail?: string | null;
}) {
  const workerUrl = resolveEmailApiBase();
  const created = await studioApi.createNewsletter({
    name: input.name.trim(),
    domain: input.domain,
    audienceGroupId: input.audienceGroupId,
    ...(workerUrl ? { workerUrl } : {}),
  });
  return studioApi.updateNewsletter(created.id, {
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
  const created = await studioApi.createTrigger({
    name: input.name.trim(),
    domain: input.domain,
    purpose: input.purpose,
  });
  return studioApi.updateTrigger(created.id, patchBodyFromHubTemplate(input.hubTemplateId, input.snapshot));
}
