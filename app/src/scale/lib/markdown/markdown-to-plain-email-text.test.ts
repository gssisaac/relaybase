import assert from "node:assert/strict";
import test from "node:test";

import { markdownToPlainEmailText } from "./markdown-to-plain-email-text.ts";

const PARTNER_NOTE = `Hello {{contact.name}},

Thank you for being a **design partner** on Relaybase Scale. This note sets expectations for the next two weeks of testing.

**We need from you**

* One **test send** and one **small real send** (≤10 recipients) with notes on anything confusing.

* Screenshots or Loom if the UI blocks you — especi{{contact.name}}ally Publish and Stats tabs.

* Honest feedback on copy, footers, and unsubscribe flow.

**We owe you**

* Same-day replies on blocking bugs during business hours (UTC+7).

* A written changelog when we flip List-Unsubscribe headers on the Worker.

No NDA beyond what you already agreed — feel free to talk about the experience, not other customers’ data.

Gratefully,\\
 Isaac`;

test("markdownToPlainEmailText strips bold, bullets, and hard-break backslashes", () => {
  const plain = markdownToPlainEmailText(PARTNER_NOTE);

  assert.ok(!plain.includes("**"), plain);
  assert.ok(!plain.includes("* One"), plain);
  assert.match(plain, /Thank you for being a design partner/);
  assert.match(plain, /We need from you/);
  assert.match(plain, /• One test send/);
  assert.match(plain, /Gratefully,\nIsaac/);
  assert.doesNotMatch(plain, /\\\n/);
  assert.match(plain, /especi\{\{contact\.name\}\}ally/);
});

test("markdownToPlainEmailText converts headings and links", () => {
  const md = `### Three things to try

* First **item**

[Launch notes](https://example.com/a) · [Demo](https://example.com/b)`;

  const plain = markdownToPlainEmailText(md);
  assert.match(plain, /Three things to try/);
  assert.doesNotMatch(plain, /^###/m);
  assert.match(plain, /Launch notes · Demo/);
  assert.doesNotMatch(plain, /https:\/\/example.com/);
});
