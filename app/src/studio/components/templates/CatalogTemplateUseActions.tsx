"use client";

import { studioApi, type StudioTemplate } from "@/studio/api";
import { HubTemplateUseMenu } from "@/studio/components/templates/HubTemplateUseMenu";
import { catalogTemplateSnapshot } from "@/studio/lib/templates/catalog-template-snapshot";
import {
  isNewsletterPrimaryTemplate,
  isTriggerPrimaryTemplate,
  triggerPurposeFromCatalogTemplate,
} from "@/studio/lib/templates/catalog-template-audience";

export function CatalogTemplateUseActions({ template }: { template: StudioTemplate }) {
  const defaultTitle =
    template.name.trim() || template.subject.trim() || "Untitled template";

  const preferredPrimary = isTriggerPrimaryTemplate(template)
    ? "trigger"
    : isNewsletterPrimaryTemplate(template)
      ? "newsletter"
      : "menu";

  return (
    <HubTemplateUseMenu
      defaultTitle={defaultTitle}
      hubTemplateId={template.id}
      preferredPrimary={preferredPrimary}
      defaultTriggerPurpose={triggerPurposeFromCatalogTemplate(template)}
      mergeTagSource={{
        subject: template.subject,
        bodyMarkdown: template.bodyMarkdown,
      }}
      resolveSnapshot={async () => catalogTemplateSnapshot(template)}
      runTestSend={async (input) => {
        const { message } = await studioApi.useTemplate(template.id);
        await studioApi.testSendMessage(message.id, input);
      }}
    />
  );
}
