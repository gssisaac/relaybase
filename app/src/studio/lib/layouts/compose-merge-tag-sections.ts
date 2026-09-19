import {
  BROADCAST_MERGE_TAGS,
} from "@/studio/lib/newsletters/newsletter-merge-tags";
import {
  templateVariableToken,
  type TemplateVariablesSchema,
} from "@/studio/lib/layouts/layout-template-variables";
import type { ComposeMergeTagSection } from "@/studio/lib/triggers/trigger-merge-tags";

export function layoutVariableMergeTagSection(
  schema: TemplateVariablesSchema | null | undefined,
): ComposeMergeTagSection | null {
  if (!schema?.fields.length) return null;
  return {
    title: "Layout",
    tags: schema.fields.map((field) => ({
      id: `vars-${field.key}`,
      token: templateVariableToken(field.key),
      label: field.label,
      description: field.description,
    })),
  };
}

/** Recipient tags plus layout `{{vars.*}}` tags for template/newsletter compose. */
export function composeBroadcastMergeTagSections(
  layoutSchema: TemplateVariablesSchema | null | undefined,
): ComposeMergeTagSection[] {
  const sections: ComposeMergeTagSection[] = [
    {
      title: "Recipient",
      tags: BROADCAST_MERGE_TAGS.map((t) => ({
        id: t.id,
        token: t.token,
        label: t.label,
        description: t.description,
      })),
    },
  ];
  const layoutSection = layoutVariableMergeTagSection(layoutSchema);
  if (layoutSection) sections.push(layoutSection);
  return sections;
}
