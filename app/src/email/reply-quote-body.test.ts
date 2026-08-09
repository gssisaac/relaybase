import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  joinQuotedBody,
  splitQuotedBody,
  splitQuotedHtml,
  trimQuotedHistoryForThread,
} from "./reply-quote-body.ts";

describe("splitQuotedBody / joinQuotedBody", () => {
  it("splits empty reply + On … wrote: quote (reply prefill)", () => {
    const quote =
      "On Aug 9, 2026, 2:44 AM, gssisaac@gmail.com wrote:\n\n> Hello\n> > Nested";
    const body = `\n\n${quote}`;
    const split = splitQuotedBody(body);
    assert.equal(split.reply, "");
    assert.equal(split.quote, quote);
    assert.equal(joinQuotedBody(split.reply, split.quote), body);
  });

  it("rejoins reply text above quote cleanly", () => {
    const quote =
      "On Aug 9, 2026, 1:50 PM, a@b.com wrote:\n\n> Prior message";
    const body = `Thanks!\n\n${quote}`;
    const split = splitQuotedBody(body);
    assert.equal(split.reply, "Thanks!");
    assert.equal(split.quote, quote);
    assert.equal(joinQuotedBody("Thanks!", quote), body);
    assert.equal(joinQuotedBody("Updated", quote), `Updated\n\n${quote}`);
  });

  it("returns null quote when body has no quote", () => {
    const body = "Just a normal message\nwith two lines";
    const split = splitQuotedBody(body);
    assert.equal(split.reply, body);
    assert.equal(split.quote, null);
    assert.equal(joinQuotedBody(split.reply, split.quote), body);
  });

  it("fallback-splits blank-line + >-prefixed block", () => {
    const body = "My reply\n\n> quoted line\n> another";
    const split = splitQuotedBody(body);
    assert.equal(split.reply, "My reply");
    assert.equal(split.quote, "> quoted line\n> another");
    assert.equal(
      joinQuotedBody(split.reply, split.quote),
      "My reply\n\n> quoted line\n> another",
    );
  });

  it("splits Gmail two-line On … / wrote: header", () => {
    const body =
      "Can I use it for free?\n\nOn Sun, Aug 9, 2026 at 1:56 AM Isaac Lee <a@b.com>\nwrote:\n\n> Prior";
    const split = splitQuotedBody(body);
    assert.equal(split.reply, "Can I use it for free?");
    assert.ok(split.quote?.startsWith("On Sun,"));
  });
});

describe("splitQuotedHtml / trimQuotedHistoryForThread", () => {
  it("cuts HTML at gmail_quote", () => {
    const html =
      '<div>Hello</div><div class="gmail_quote">On wrote:<blockquote>old</blockquote></div>';
    const split = splitQuotedHtml(html);
    assert.equal(split.replyHtml, "<div>Hello</div>");
    assert.ok(split.quoteHtml?.includes("gmail_quote"));
  });

  it("trims nested history for thread display", () => {
    const trimmed = trimQuotedHistoryForThread({
      bodyText:
        "I have a Question?\n\nOn Sun, Aug 9, 2026 at 1:56 AM Isaac Lee <a@b.com> wrote:\n\n> Hey",
      bodyHtml: "<div>full html with quote</div>",
    });
    assert.equal(trimmed.bodyText, "I have a Question?");
    assert.equal(trimmed.bodyHtml, undefined);
    assert.ok(trimmed.quoteText?.includes("On Sun,"));
  });
});
