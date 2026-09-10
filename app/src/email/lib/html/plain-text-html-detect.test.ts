import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  extractPlainTextFromEmailHtml,
  isPlainTextEmailHtml,
} from "./plain-text-html-detect.ts";

describe("isPlainTextEmailHtml", () => {
  it("treats Gmail's typed-reply wrapper as plain text", () => {
    const html = '<div dir="ltr">Hey — how are you?<br><br>Best,<br>Isaac</div>';
    assert.equal(isPlainTextEmailHtml(html), true);
  });

  it("treats basic formatting (bold, italic, links, lists) as plain text", () => {
    const html =
      "<div>Here's the plan:<ul><li>Ship it</li><li>Tell <b>everyone</b></li></ul>" +
      '<a href="https://example.com">Details</a></div>';
    assert.equal(isPlainTextEmailHtml(html), true);
  });

  it("rejects HTML containing an image", () => {
    const html = '<div>Look at this <img src="https://example.com/a.png"></div>';
    assert.equal(isPlainTextEmailHtml(html), false);
  });

  it("rejects layout tables", () => {
    const html =
      "<table><tr><td>Left</td><td>Right</td></tr></table>";
    assert.equal(isPlainTextEmailHtml(html), false);
  });

  it("rejects inline-attachment (cid:) references", () => {
    const html = '<div style="background-image:url(cid:logo)">Hi</div>';
    assert.equal(isPlainTextEmailHtml(html), false);
  });

  it("rejects a designed background color", () => {
    const html = '<div style="background-color:#ffcc00">Sale!</div>';
    assert.equal(isPlainTextEmailHtml(html), false);
  });

  it("rejects unrecognized structural tags (marketing sections)", () => {
    const html = "<section><h1>Big headline</h1></section>";
    assert.equal(isPlainTextEmailHtml(html), false);
  });

  it("rejects empty input", () => {
    assert.equal(isPlainTextEmailHtml(""), false);
    assert.equal(isPlainTextEmailHtml("   "), false);
  });
});

describe("extractPlainTextFromEmailHtml", () => {
  it("converts <br> and block closes into line breaks", () => {
    const html = '<div dir="ltr">Hey — how are you?<br><br>Best,<br>Isaac</div>';
    assert.equal(
      extractPlainTextFromEmailHtml(html),
      "Hey — how are you?\n\nBest,\nIsaac",
    );
  });

  it("bullets list items and decodes entities", () => {
    const html = "<ul><li>Ship it</li><li>A &amp; B</li></ul>";
    assert.equal(extractPlainTextFromEmailHtml(html), "• Ship it\n• A & B");
  });

  it("drops tags but keeps link text", () => {
    const html = '<p>See <a href="https://example.com">the docs</a>.</p>';
    assert.equal(extractPlainTextFromEmailHtml(html), "See the docs.");
  });
});
