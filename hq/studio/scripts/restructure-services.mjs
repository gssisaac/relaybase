#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../src");
const REPLACEMENTS = [
  ["@lib/templates/", "@services/template/"],
  ["@lib/messages/", "@services/message/"],
  ["@lib/newsletters/", "@services/newsletter/"],
  ["@lib/triggers/", "@services/trigger/"],
  ["@lib/subscriber-groups/", "@services/subscriber/"],
  ["@lib/compliance/", "@services/account/"],
  ["@lib/account-link/", "@services/account/"],
  ["@lib/account/", "@services/account/"],
  ["@lib/tracking/", "@services/tracking/"],
  ["@lib/analytics/", "@services/analytics/"],
  ["@lib/dashboard/", "@services/analytics/"],
  ["@lib/assets/", "@services/asset/"],
  ["@lib/unsubscribe/", "@services/subscriber/"],
  ["@lib/worker/fetch-console-domains", "@services/account/console-domains"],
];

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (ent.name.endsWith(".ts")) out.push(p);
  }
  return out;
}

for (const file of walk(ROOT)) {
  let text = fs.readFileSync(file, "utf8");
  let next = text;
  for (const [from, to] of REPLACEMENTS) next = next.split(from).join(to);
  if (next !== text) fs.writeFileSync(file, next);
}
