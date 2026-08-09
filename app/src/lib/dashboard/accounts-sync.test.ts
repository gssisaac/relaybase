import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  notifyAddressesChanged,
  subscribeAddressesChanged,
} from "./accounts-sync.ts";

describe("accounts-sync", () => {
  it("notifies subscribers without coupling stores", () => {
    const events: Array<{ domain?: string; emails?: string[] }> = [];
    const unsubscribe = subscribeAddressesChanged((event) => {
      events.push(event);
    });

    notifyAddressesChanged({
      domain: "example.com",
      emails: ["hello@example.com"],
    });
    notifyAddressesChanged();

    assert.equal(events.length, 2);
    assert.deepEqual(events[0], {
      domain: "example.com",
      emails: ["hello@example.com"],
    });
    assert.deepEqual(events[1], {});

    unsubscribe();
    notifyAddressesChanged({ domain: "ignored.com" });
    assert.equal(events.length, 2);
  });

  it("keeps other listeners when one throws", () => {
    const seen: string[] = [];
    const unsub1 = subscribeAddressesChanged(() => {
      throw new Error("boom");
    });
    const unsub2 = subscribeAddressesChanged((event) => {
      seen.push(event.domain ?? "");
    });

    notifyAddressesChanged({ domain: "ok.com" });
    assert.deepEqual(seen, ["ok.com"]);

    unsub1();
    unsub2();
  });
});
