import type { Template } from "@db/types";

/** Built-in catalog blueprints (also in git `catalog/templates/`). */
export function getPresetTemplates(now: string): Template[] {
  return [
    {
      id: "msgtpl_preset_product_update",
      name: "Product update (starter)",
      description: "A short release note your subscribers can skim in under a minute.",
      subject: "What's new in {{vars.brand.organization_name}}",
      previewText: "A short release note your subscribers can skim in under a minute.",
      bodyMarkdown:
        "Hello {{contact.name}},\n\nWe shipped a few improvements this week:\n\n- **Feature one** — one sentence on the outcome.\n- **Feature two** — who it helps and how to turn it on.\n\n[Read the full changelog](https://relaybase.com/changelog)\n\nThanks for reading,\nThe team",
      layoutId: "tpl-minimal",
      templateVariables: {},
      category: "newsletter",
      isBuiltin: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "msgtpl_preset_verify_email",
      name: "Verify email (transactional)",
      description: "Confirm this address to finish creating an account.",
      subject: "Verify your email",
      previewText: "Confirm this address to finish creating your account",
      bodyMarkdown:
        "Hi {{contact.name}},\n\nConfirm this address to finish creating your account.\n\n[Verify email]({{trigger.verifyUrl}})\n\nIf you did not sign up, ignore this message.\n\n— Relaybase",
      layoutId: "tpl-minimal",
      templateVariables: {},
      category: "transactional",
      isBuiltin: true,
      createdAt: now,
      updatedAt: now,
    },
  ];
}
