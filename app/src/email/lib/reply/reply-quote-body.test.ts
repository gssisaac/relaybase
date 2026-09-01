import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  joinQuotedBody,
  normalizeQuoteForDisplay,
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

  it("preserves trailing spaces through compose round-trip", () => {
    const quote =
      "On Aug 9, 2026, 1:50 PM, a@b.com wrote:\n\n> Prior message";
    const joined = joinQuotedBody("Thanks ", quote);
    assert.equal(joined, `Thanks \n\n${quote}`);
    const split = splitQuotedBody(joined);
    assert.equal(split.reply, "Thanks ");
    assert.equal(split.quote, quote);
    assert.equal(joinQuotedBody(split.reply, split.quote), joined);
  });

  it("preserves trailing newlines through compose round-trip", () => {
    const quote =
      "On Aug 9, 2026, 1:50 PM, a@b.com wrote:\n\n> Prior message";
    const joined = joinQuotedBody("Thanks\n", quote);
    assert.equal(joined, `Thanks\n\n\n${quote}`);
    const split = splitQuotedBody(joined);
    assert.equal(split.reply, "Thanks\n");
    assert.equal(split.quote, quote);
    assert.equal(joinQuotedBody(split.reply, split.quote), joined);

    const twoLines = joinQuotedBody("Line one\nLine two\n\n", quote);
    const splitTwo = splitQuotedBody(twoLines);
    assert.equal(splitTwo.reply, "Line one\nLine two\n\n");
    assert.equal(joinQuotedBody(splitTwo.reply, splitTwo.quote), twoLines);
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

  it("inline-splits collapsed `On … wrote:` not on its own line", () => {
    // bodyPreview-style: whitespace collapsed, reply + header on one line.
    const body =
      "Thanks for relying On Aug 12, 2026, 12:34 PM, Isaac Lee wrote: > Hi Isaac, > > I think so too.";
    const split = splitQuotedBody(body);
    assert.equal(split.reply, "Thanks for relying");
    assert.ok(split.quote?.startsWith("On Aug 12, 2026"));
    assert.ok(split.quote?.includes("> Hi Isaac"));
  });

  it("does not inline-split prose that merely contains `On … wrote:`", () => {
    const body = "On Tuesday I wrote a note about the meeting.";
    const split = splitQuotedBody(body);
    assert.equal(split.quote, null);
    assert.equal(split.reply, body);
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

  it("reply quote pipeline keeps only the new message lines", () => {
    const trimmed = trimQuotedHistoryForThread({
      bodyText:
        "Can I use it for free?\n\nOn Sun, Aug 9, 2026 at 1:56 AM x wrote:\n\n> Prior\n> > Older",
    });
    const quoted = trimmed.bodyText
      .split(/\r?\n/)
      .map((line) => `> ${line}`)
      .join("\n");
    assert.match(quoted, /> Can I use it for free\?/);
    assert.doesNotMatch(quoted, /Prior/);
    assert.doesNotMatch(quoted, /Older/);
  });

  it("does not cut a Gmail HTML forward at gmail_quote", () => {
    const html =
      '<div dir="ltr"><br><br><div class="gmail_quote gmail_quote_container"><div dir="ltr" class="gmail_attr">---------- Forwarded message ---------<br>From: Skool &lt;noreply@skool.com&gt;<br></div><br><div style="background:#ffffff"><h1>SaaS breakdown Analyze</h1><a href="https://www.skool.com/calendar">VIEW CALENDAR</a></div></div></div>';
    const split = splitQuotedHtml(html);
    assert.equal(split.quoteHtml, null);
    assert.ok(split.replyHtml.includes("VIEW CALENDAR"));

    const trimmed = trimQuotedHistoryForThread({
      bodyText:
        "---------- Forwarded message ---------\nFrom: Skool <noreply@skool.com>\n\nSaaS breakdown Analyze\nVIEW CALENDAR",
      bodyHtml: html,
    });
    assert.ok(trimmed.bodyHtml?.includes("VIEW CALENDAR"));
    assert.equal(trimmed.quoteText, null);
  });

  it("keeps a user note plus the Gmail-forwarded original", () => {
    const html =
      '<div dir="ltr">FYI see this<br><br><div class="gmail_quote"><div class="gmail_attr">---------- Forwarded message ---------<br>From: A<br></div><p>Original body</p></div></div>';
    const split = splitQuotedHtml(html);
    assert.equal(split.quoteHtml, null);
    assert.ok(split.replyHtml.includes("FYI see this"));
    assert.ok(split.replyHtml.includes("Original body"));
  });

  it("still trims a reply that quotes a nested forward", () => {
    const html =
      '<div>Thanks</div><div class="gmail_quote"><div class="gmail_attr">On Tue, Sep 1, 2026 at 12:27 PM Isaac Lee wrote:<br></div><blockquote class="gmail_quote"><div class="gmail_quote"><div class="gmail_attr">---------- Forwarded message ---------<br></div><p>Original</p></div></blockquote></div>';
    const split = splitQuotedHtml(html);
    assert.equal(split.replyHtml, "<div>Thanks</div>");
    assert.ok(split.quoteHtml?.includes("gmail_quote"));
    assert.ok(split.quoteHtml?.includes("Forwarded message"));
  });

  it("does not hide an empty-wrapper + quote as a white box", () => {
    const html =
      '<div dir="ltr"><br><br></div><div class="gmail_quote"><div class="gmail_attr">On Sun wrote:<br></div><blockquote>old</blockquote></div>';
    const split = splitQuotedHtml(html);
    assert.equal(split.quoteHtml, null);
    assert.ok(split.replyHtml.includes("old"));
  });

  it("keeps a forwarded thread whose original contains On … wrote:", () => {
    const trimmed = trimQuotedHistoryForThread({
      bodyText:
        "---------- Forwarded message ---------\nFrom: A\n\nThanks\n\nOn Sun, Aug 9, 2026 at 1:56 AM x wrote:\n\n> Hey",
      bodyHtml:
        '<div dir="ltr"><br><div class="gmail_quote"><div class="gmail_attr">---------- Forwarded message ---------<br>From: A</div><div>Thanks</div></div></div>',
    });
    assert.ok(trimmed.bodyText.includes("---------- Forwarded message ---------"));
    assert.ok(trimmed.bodyText.includes("On Sun,"));
    assert.ok(trimmed.bodyHtml?.includes("Forwarded message"));
    assert.equal(trimmed.quoteText, null);
  });
});

describe("normalizeQuoteForDisplay", () => {
  it("passes multiline quotes through unchanged", () => {
    const quote =
      "On Aug 9, 2026, 1:50 PM, a@b.com wrote:\n\n> Prior\n> > Older";
    assert.equal(normalizeQuoteForDisplay(quote), quote);
  });

  it("re-expands a whitespace-collapsed quote into line-per-quote form", () => {
    const collapsed =
      "On Aug 12, 2026, 12:34 PM, Isaac Lee wrote: > Hi Isaac, > > I think so too. > > Best, > > Isaac Lee";
    const out = normalizeQuoteForDisplay(collapsed);
    const lines = out.split("\n");
    assert.ok(lines[0]!.startsWith("On Aug 12, 2026"));
    assert.ok(lines.includes("> Hi Isaac,"));
    // Collapsed `> >` (a blank `>` line + a depth-1 line) re-expands to a
    // depth-2 rail — an inherent ambiguity of un-collapsing; acceptable behind
    // the ··· expander.
    assert.ok(lines.includes("> > I think so too."));
    assert.ok(lines.includes("> > Best,"));
    assert.ok(lines.includes("> > Isaac Lee"));
  });

  it("re-expands deeply nested collapsed quotes preserving depth runs", () => {
    const collapsed =
      "On Aug 12, 2026, 12:34 PM, Isaac Lee wrote: > > > > Hey, > > > > The best AI users";
    const out = normalizeQuoteForDisplay(collapsed);
    const lines = out.split("\n");
    assert.ok(lines[0]!.startsWith("On Aug 12, 2026"));
    assert.ok(lines.includes("> > > > Hey,"));
    assert.ok(lines.includes("> > > > The best AI users"));
  });
});
