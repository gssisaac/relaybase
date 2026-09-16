"use client";

import { studioApi, type StudioTemplate } from "@/lib/studio/api";
import { HubTemplateUseMenu } from "@/studio/components/templates/HubTemplateUseMenu";
import { catalogTemplateSnapshot } from "@/studio/lib/templates/catalog-template-snapshot";

export function CatalogTemplateUseActions({ template }: { template: StudioTemplate }) {
  const defaultTitle =
    template.name.trim() || template.subject.trim() || "Untitled template";

  return (
    <HubTemplateUseMenu
      defaultTitle={defaultTitle}
      hubTemplateId={template.id}
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
