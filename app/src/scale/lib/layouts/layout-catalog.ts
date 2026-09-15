/** Must match hq/scale `PLAIN_TEXT_TEMPLATE_ID`. */
export const PLAIN_TEXT_TEMPLATE_ID = "tpl-plain-text";

export function isPlainTextTemplate(templateId: string | null | undefined): boolean {
  return templateId === PLAIN_TEXT_TEMPLATE_ID;
}
