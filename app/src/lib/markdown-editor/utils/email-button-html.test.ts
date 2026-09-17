import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  emailButtonMarkerHtml,
  renderBulletproofEmailButton,
  transformEmailButtonMarkersToBulletproof,
} from "./email-button-html.ts";
import { promoteEmailButtonBlocks, serializeEmailButtonBlockMarkdown } from "./email-button-markdown.ts";

describe("emailButtonMarkerHtml", () => {
  it("serializes props to a stable marker div", () => {
    const marker = emailButtonMarkerHtml({
      text: "Read more",
      url: "https://example.com/path?q=1",
      variant: "outline",
      alignment: "center",
    });
    assert.match(marker, /data-rb-email-button/);
    assert.match(marker, /data-text="Read more"/);
    assert.match(marker, /data-href="https:\/\/example.com\/path\?q=1"/);
  });
});

describe("transformEmailButtonMarkersToBulletproof", () => {
  it("replaces marker divs with table-based buttons", () => {
    const marker = emailButtonMarkerHtml({
      text: "Go",
      url: "https://relaybase.com",
      variant: "primary",
      alignment: "center",
    });
    const html = transformEmailButtonMarkersToBulletproof(`<p>Hi</p>${marker}`);
    assert.match(html, /<table role="presentation"/);
    assert.match(html, /href="https:\/\/relaybase.com"/);
    assert.match(html, /Go/);
    assert.doesNotMatch(html, /data-rb-email-button/);
  });
});

describe("renderBulletproofEmailButton", () => {
  it("sets explicit link color so Gmail styling skips it", () => {
    const html = renderBulletproofEmailButton({
      text: "CTA",
      url: "https://x.test",
      variant: "primary",
      alignment: "full",
    });
    assert.match(html, /color:#ffffff/);
    assert.match(html, /display:block/);
  });
});

describe("promoteEmailButtonBlocks", () => {
  it("promotes a paragraph containing a marker to an emailButton block", () => {
    const marker = emailButtonMarkerHtml({
      text: "Subscribe",
      url: "https://x.test/sub",
      variant: "outline",
      alignment: "left",
    });
    const [block] = promoteEmailButtonBlocks([
      {
        type: "paragraph",
        content: [{ type: "text", text: marker }],
        children: [],
      },
    ]);
    assert.equal(serializeEmailButtonBlockMarkdown(block), marker);
    assert.match(serializeEmailButtonBlockMarkdown(block)!, /data-align="left"/);
  });
});
