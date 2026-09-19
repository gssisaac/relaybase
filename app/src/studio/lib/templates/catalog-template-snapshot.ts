import type { StudioTemplate } from "@/studio/api";
import type { HubTemplateSnapshot } from "@/studio/lib/templates/hub-template-launch";

export function catalogTemplateSnapshot(template: StudioTemplate): HubTemplateSnapshot {
  return {
    subject: template.subject,
    previewText: template.previewText ?? "",
    bodyMarkdown: template.bodyMarkdown,
    layoutId: template.layoutId,
    templateVariables: template.templateVariables ?? {},
  };
}
