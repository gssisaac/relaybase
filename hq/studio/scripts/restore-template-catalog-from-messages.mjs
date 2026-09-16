/**
 * Restore template-catalog from demo message YAML (automation / broadcast / preset).
 * Keeps owned message YAML on disk for newsletter/trigger sends.
 * Seeds two standalone library messages (msg_library_*).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Document, isScalar, parse as parseYaml, Scalar } from "yaml";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = process.env.STUDIO_DATA_DIR ?? path.join(root, "data");
const messagesDir = path.join(dataDir, "messages");
const catalogDir = path.join(dataDir, "template-catalog");

function isCatalogSourceId(id) {
  return (
    id.startsWith("msgtpl_automation_") ||
    id.startsWith("msgtpl_broadcast_") ||
    id.startsWith("msgtpl_preset_")
  );
}

function toTemplate(row) {
  const layoutId = row.layoutId === "tpl-header-image" ? "tpl-header" : row.layoutId;
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? row.previewText ?? null,
    subject: row.subject ?? "",
    previewText: row.previewText ?? null,
    bodyMarkdown: row.bodyMarkdown ?? "",
    layoutId: layoutId ?? "tpl-minimal",
    templateVariables: row.templateVariables ?? {},
    category: row.category ?? null,
    isBuiltin: true,
    createdAt: row.createdAt ?? new Date().toISOString(),
    updatedAt: row.updatedAt ?? new Date().toISOString(),
  };
}

function stringifyTemplate(template) {
  const doc = new Document(template);
  const bodyNode = doc.getIn(["bodyMarkdown"], true);
  if (
    bodyNode &&
    isScalar(bodyNode) &&
    typeof bodyNode.value === "string" &&
    bodyNode.value.includes("\n")
  ) {
    bodyNode.type = Scalar.BLOCK_LITERAL;
  }
  return `${String(doc)}\n`;
}

function writeMessage(row) {
  const doc = new Document(row);
  const bodyNode = doc.getIn(["bodyMarkdown"], true);
  if (
    bodyNode &&
    isScalar(bodyNode) &&
    typeof bodyNode.value === "string" &&
    bodyNode.value.includes("\n")
  ) {
    bodyNode.type = Scalar.BLOCK_LITERAL;
  }
  fs.writeFileSync(path.join(messagesDir, `${row.id}.yaml`), `${String(doc)}\n`, "utf8");
}

fs.mkdirSync(catalogDir, { recursive: true });
fs.mkdirSync(messagesDir, { recursive: true });

const files = fs.readdirSync(messagesDir).filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"));
let catalogWritten = 0;

for (const file of files) {
  const parsed = parseYaml(fs.readFileSync(path.join(messagesDir, file), "utf8"));
  if (!parsed?.id || !isCatalogSourceId(parsed.id)) continue;
  fs.writeFileSync(
    path.join(catalogDir, `${parsed.id}.yaml`),
    stringifyTemplate(toTemplate(parsed)),
    "utf8",
  );
  catalogWritten += 1;
  if (parsed.id.startsWith("msgtpl_preset_")) {
    fs.unlinkSync(path.join(messagesDir, file));
  }
}

const now = new Date().toISOString();
const librarySeeds = [
  {
    id: "msg_library_product_update",
    accountLinkId: "dev",
    name: "Product update (my copy)",
    subject: "What's new this week",
    previewText: "Editable message forked from the catalog.",
    bodyMarkdown:
      "Hello {{contact.name}},\n\nHere is your saved product update draft.\n\n— Team",
    layoutId: "tpl-minimal",
    templateVariables: {},
    forkedFromTemplateId: "msgtpl_preset_product_update",
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "msg_library_verify_email",
    accountLinkId: "dev",
    name: "Verify email (my copy)",
    subject: "Verify your email",
    previewText: null,
    bodyMarkdown:
      "Hi {{contact.name}},\n\nConfirm this address to finish creating your account.\n\n[Verify email]({{trigger.verifyUrl}})",
    layoutId: "tpl-minimal",
    templateVariables: {},
    forkedFromTemplateId: "msgtpl_preset_verify_email",
    createdAt: now,
    updatedAt: now,
  },
];

for (const row of librarySeeds) {
  writeMessage(row);
}

console.log(
  `Restored ${catalogWritten} catalog templates under ${catalogDir}; library messages: ${librarySeeds.map((r) => r.id).join(", ")}`,
);
