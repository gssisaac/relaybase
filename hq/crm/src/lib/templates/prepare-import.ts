import {
  COMPLIANCE_FOOTER_TAG,
  templateHasEmbeddedComplianceFooter,
} from "./standard-footer";
import {
  normalizeTemplateVariablesSchema,
  parseTemplateVariablesYaml,
} from "./variable-schema";

export type PreparedTemplateImport = {
  htmlSource: string;
  warnings: string[];
  variablesSchema: ReturnType<typeof normalizeTemplateVariablesSchema>;
};

export function prepareTemplateImport(input: {
  htmlSource: string;
  variablesYaml?: string;
}): PreparedTemplateImport | { error: string } {
  const htmlSource = input.htmlSource;
  if (!htmlSource.includes("{{content}}")) {
    return {
      error: "Template must include a {{content}} placeholder marking where content goes.",
    };
  }

  let resolvedHtml = htmlSource;
  if (!templateHasEmbeddedComplianceFooter(htmlSource)) {
    resolvedHtml = `${htmlSource.trimEnd()}\n${COMPLIANCE_FOOTER_TAG}`;
  }

  const warnings: string[] = [];
  if (
    !resolvedHtml.includes("{{unsubscribe_url}}") &&
    !resolvedHtml.includes(COMPLIANCE_FOOTER_TAG)
  ) {
    warnings.push("Missing unsubscribe link increases spam-report risk.");
  }

  const variablesSchema =
    normalizeTemplateVariablesSchema(parseTemplateVariablesYaml(input.variablesYaml ?? "")) ??
    null;

  return { htmlSource: resolvedHtml, warnings, variablesSchema };
}
