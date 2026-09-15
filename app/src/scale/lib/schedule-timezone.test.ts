import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  dateKeyInTimeZone,
  weekdayOfGregorianDateInTimeZone,
} from "./schedule-timezone.ts";

describe("schedule-timezone", () => {
  it("buckets UTC instants by IANA zone calendar date", () => {
    const instant = new Date("2030-06-15T22:00:00.000Z");
    assert.equal(dateKeyInTimeZone(instant, "UTC"), "2030-06-15");
    assert.equal(dateKeyInTimeZone(instant, "America/Los_Angeles"), "2030-06-15");
    assert.equal(dateKeyInTimeZone(instant, "Asia/Tokyo"), "2030-06-16");
  });

  it("aligns month grid start weekday with zone", () => {
    const weekday = weekdayOfGregorianDateInTimeZone(2030, 5, 1, "UTC");
    assert.equal(weekday, new Date(Date.UTC(2030, 5, 1)).getUTCDay());
  });
});
