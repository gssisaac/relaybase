import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  draftThreadRowSubtitle,
  formatDraftAttribution,
} from "./draft-thread-rows.ts";

describe("formatDraftAttribution", () => {
  it("formats Gmail-style weekday + at + angle brackets", () => {
    // Local timezone — assert structure via Date parts.
    const iso = "2026-08-09T15:56:00.000Z";
    const date = new Date(iso);
    const text = formatDraftAttribution(iso, "isaac@example.com");
    assert.match(text, /^On (Sun|Mon|Tue|Wed|Thu|Fri|Sat), /);
    assert.match(text, / at \d{1,2}:\d{2} (AM|PM) <isaac@example\.com>$/);
    assert.ok(text.includes(`Aug ${date.getDate()}, 2026`));
  });
});

describe("draftThreadRowSubtitle", () => {
  it("prefers the On … wrote: header from the draft body", () => {
    const body =
      "Thanks\n\nOn Sun, Aug 9, 2026 at 3:56 PM Isaac Lee <isaac@example.com> wrote:\n\n> Hi";
    assert.equal(
      draftThreadRowSubtitle(body, null),
      "On Sun, Aug 9, 2026 at 3:56 PM Isaac Lee <isaac@example.com>",
    );
  });

  it("falls back to parent attribution", () => {
    const text = draftThreadRowSubtitle("", {
      at: "2026-08-09T15:56:00.000Z",
      email: "isaac@example.com",
    });
    assert.match(text, /<isaac@example\.com>$/);
    assert.match(text, /^On /);
  });
});
