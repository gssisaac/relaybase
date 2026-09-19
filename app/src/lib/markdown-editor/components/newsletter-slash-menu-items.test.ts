import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { filterSuggestionItems } from "@blocknote/core/extensions";

import {
  buildMergeTagAliases,
  mergeTagSlashMenuEntries,
} from "./newsletter-slash-menu-merge-tags";
import type { ComposeMergeTagSection } from "@/studio/lib/triggers/trigger-merge-tags";

describe("buildMergeTagAliases", () => {
  it("builds searchable aliases for contact merge tags", () => {
    const aliases = buildMergeTagAliases({
      id: "contact-name",
      token: "{{contact.name}}",
      label: "Contact name",
      description: "Subscriber display name from the subscriber group.",
    });

    assert.ok(aliases.includes("{{contact.name}}"));
    assert.ok(aliases.includes("contact.name"));
    assert.ok(aliases.includes("contact"));
    assert.ok(aliases.includes("name"));
    assert.ok(aliases.includes("contact name"));
  });

  it("builds searchable aliases for layout variable tags", () => {
    const aliases = buildMergeTagAliases({
      id: "vars-brand-org",
      token: "{{vars.brand.organization_name}}",
      label: "Organization name",
      description: "Company brand name",
    });

    assert.ok(aliases.includes("{{vars.brand.organization_name}}"));
    assert.ok(aliases.includes("vars.brand.organization_name"));
    assert.ok(aliases.includes("organization"));
    assert.ok(aliases.includes("brand"));
    assert.ok(aliases.includes("org"));
    assert.ok(aliases.includes("vars"));
  });
});

describe("mergeTagSlashMenuEntries", () => {
  const sections: ComposeMergeTagSection[] = [
    {
      title: "Recipient",
      tags: [
        { id: "contact-name", token: "{{contact.name}}", label: "Contact name" },
        { id: "contact-email", token: "{{contact.email}}", label: "Contact email" },
      ],
    },
    {
      title: "Layout",
      tags: [
        {
          id: "vars-org",
          token: "{{vars.brand.organization_name}}",
          label: "Organization name",
        },
      ],
    },
  ];

  it("lists merge tags before block items when prepended to slash menu", () => {
    const entries = mergeTagSlashMenuEntries(sections);
    assert.strictEqual(entries[0].title, "{{contact.name}}");
    assert.strictEqual(entries[0].group, "Recipient");
    assert.strictEqual(entries[2].title, "{{vars.brand.organization_name}}");
    assert.strictEqual(entries[2].group, "Layout");
  });

  it("filters merge tags by query alias or token", () => {
    const entries = mergeTagSlashMenuEntries(sections);
    const asMenuItems = entries.map((e) => ({
      title: e.title,
      aliases: e.aliases,
    }));

    const nameMatches = filterSuggestionItems(asMenuItems, "name").map((m) => m.title);
    assert.ok(nameMatches.includes("{{contact.name}}"));
    assert.ok(nameMatches.includes("{{vars.brand.organization_name}}"));
    assert.ok(!nameMatches.includes("{{contact.email}}"));

    const emailMatches = filterSuggestionItems(asMenuItems, "email").map((m) => m.title);
    assert.ok(emailMatches.includes("{{contact.email}}"));
    assert.ok(!emailMatches.includes("{{contact.name}}"));

    const orgMatches = filterSuggestionItems(asMenuItems, "org").map((m) => m.title);
    assert.ok(orgMatches.includes("{{vars.brand.organization_name}}"));
    assert.ok(!orgMatches.includes("{{contact.name}}"));
  });
});
