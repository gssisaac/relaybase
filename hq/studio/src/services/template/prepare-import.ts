import {
  STANDARD_COMPLIANCE_FOOTER_HTML_APPEND,
  templateHasEmbeddedComplianceFooter,
} from "@services/template/standard-footer";
import {
  normalizeTemplateVariablesSchema,
  parseTemplateVariablesYaml,
} from "@services/template/variable-schema";

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
    resolvedHtml = `${htmlSource.trimEnd()}\n${STANDARD_COMPLIANCE_FOOTER_HTML_APPEND}`;
  }

  const warnings: string[] = [];
  if (!templateHasEmbeddedComplianceFooter(resolvedHtml)) {
    warnings.push("Missing unsubscribe link increases spam-report risk.");
  }

  const variablesSchema =
    normalizeTemplateVariablesSchema(parseTemplateVariablesYaml(input.variablesYaml ?? "")) ??
    null;

  return { htmlSource: resolvedHtml, warnings, variablesSchema };
}
