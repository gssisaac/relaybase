import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildEmailFrameFontCss,
  wrapEmailSrcDoc,
} from "./email-frame-styles.ts";

describe("email-frame-styles", () => {
  it("wraps HTML fragments in a document with injected head styles", () => {
    const head = '<style>html, body { font-family: Inter, sans-serif; }</style>';
    const wrapped = wrapEmailSrcDoc('<div>Hello</div>', head);
    assert.match(wrapped, /^<!DOCTYPE html>/i);
    assert.match(wrapped, /<head>[\s\S]*Inter[\s\S]*<\/head>/);
    assert.match(wrapped, /<body><div>Hello<\/div><\/body>/);
  });

  it("injects head styles into a full HTML document", () => {
    const head = "<style>body { font-family: Inter; }</style>";
    const doc =
      "<!DOCTYPE html><html><head><meta charset=utf-8></head><body><p>Hi</p></body></html>";
    const wrapped = wrapEmailSrcDoc(doc, head);
    assert.match(wrapped, /<meta charset=utf-8>[\s\S]*Inter/);
    assert.match(wrapped, /<p>Hi<\/p>/);
  });

  it("buildEmailFrameFontCss forces inherit on legacy font tags", () => {
    const css = buildEmailFrameFontCss("Inter, sans-serif");
    assert.match(css, /font-family: Inter, sans-serif !important/);
    assert.match(css, /font \{\s*font-family: inherit !important;/);
  });
});
