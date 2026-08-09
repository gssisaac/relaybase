import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  escapeHtml,
  plainTextToEmailHtml,
} from "./plain-text-to-email-html.ts";

describe("escapeHtml", () => {
  it("escapes &, <, >, and quotes", () => {
    assert.equal(
      escapeHtml(`a & b <c> "d"`),
      "a &amp; b &lt;c&gt; &quot;d&quot;",
    );
  });
});

describe("plainTextToEmailHtml", () => {
  it("converts plain reply without quotes", () => {
    const html = plainTextToEmailHtml("Hello\nWorld");
    assert.equal(html, '<div dir="ltr">Hello<br>World</div>');
  });

  it("escapes user content in reply", () => {
    const html = plainTextToEmailHtml("<script>x</script>");
    assert.equal(
      html,
      "<div dir=\"ltr\">&lt;script&gt;x&lt;/script&gt;</div>",
    );
  });

  it("wraps On…wrote + > lines in gmail_quote blockquotes", () => {
    const text = [
      "Not at all.",
      "",
      "On Aug 9, 2026, 2:44 AM, gssisaac@gmail.com wrote:",
      "",
      "> I have a Question",
      "> > Nested prior",
    ].join("\n");
    const html = plainTextToEmailHtml(text);

    assert.match(html, /<div dir="ltr">Not at all\.<\/div>/);
    assert.match(html, /<div class="gmail_quote">/);
    assert.match(
      html,
      /On Aug 9, 2026, 2:44 AM, gssisaac@gmail\.com wrote:<br>/,
    );
    assert.match(
      html,
      /<blockquote class="gmail_quote" style="margin:0px 0px 0px 0\.8ex;border-left:1px solid rgb\(204,204,204\);padding-left:1ex">/,
    );
    assert.match(html, /I have a Question<br>/);
    assert.match(html, /Nested prior<br>/);
    // Nested depth → nested blockquotes
    const outerOpen = html.indexOf("<blockquote");
    const innerOpen = html.indexOf("<blockquote", outerOpen + 1);
    assert.ok(outerOpen >= 0);
    assert.ok(innerOpen > outerOpen);
    assert.ok(!html.includes("> I have"));
    assert.ok(!html.includes("&gt; I have"));
  });

  it("handles empty reply with quote prefill", () => {
    const quote =
      "On Aug 9, 2026, 2:44 AM, a@b.com wrote:\n\n> Hello";
    const html = plainTextToEmailHtml(`\n\n${quote}`);
    assert.ok(!html.includes('<div dir="ltr">'));
    assert.match(html, /^<div class="gmail_quote">/);
    assert.match(html, /Hello<br>/);
  });
});
