import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isObservable, isObservableArray } from "mobx";

import type { StudioAnalytics } from "@/studio/api";
import { AnalyticsStore } from "./analytics-store.ts";

const mockAnalytics: StudioAnalytics = {
  generatedAt: "2026-09-17T00:00:00.000Z",
  templateCount: 5,
  summary: {
    monthlySentVolume: 1200,
    scheduledSends: 2,
    sendingNow: 0,
    activeTriggers: 3,
    totalContacts: 450,
    deliverableRate: 98,
    avgOpenRate: 42,
    avgClickRate: 15,
  },
  charts: {
    sendsByWeek: [
      { week: "2026-W36", label: "Sep 1", sent: 100, opened: 45, clicked: 12 },
      { week: "2026-W37", label: "Sep 8", sent: 150, opened: 60, clicked: 20 },
    ],
    subscriberHealth: [
      { key: "active", label: "Active", count: 400 },
      { key: "unsubscribed", label: "Unsubscribed", count: 30 },
      { key: "bounced", label: "Bounced", count: 20 },
    ],
    automationTriggersByDay: [
      { day: "2026-09-10", label: "Thu Sep 10", count: 5 },
      { day: "2026-09-11", label: "Fri Sep 11", count: 8 },
    ],
    engagementRates: [
      { key: "open", label: "Avg open rate", value: 42 },
      { key: "click", label: "Avg click rate", value: 15 },
    ],
  },
  newsletters: {
    draftCount: 2,
    inProgressCount: 0,
    recentSent: [],
    cloudflareQuota: {
      usedToday: 10,
    },
  },
  triggers: {
    activeCount: 3,
    triggers24h: 12,
    recentEvents: [],
  },
};

describe("AnalyticsStore", () => {
  it("stores payload as plain non-observable JSON so Recharts/Immer can freeze data arrays", () => {
    const store = new AnalyticsStore();
    store.commitPayload(mockAnalytics);

    const data = store.data;
    assert.ok(data !== null, "data should not be null");

    // The payload and its nested arrays should NOT be MobX observables
    assert.equal(isObservable(data), false, "data object should not be observable");
    assert.equal(isObservableArray(data.charts.sendsByWeek), false, "sendsByWeek should not be an observable array");
    assert.equal(isObservableArray(data.charts.subscriberHealth), false, "subscriberHealth should not be an observable array");
    assert.equal(isObservableArray(data.charts.automationTriggersByDay), false, "automationTriggersByDay should not be an observable array");
    assert.equal(isObservableArray(data.charts.engagementRates), false, "engagementRates should not be an observable array");

    // Recharts uses Immer which freezes chart data with Object.freeze
    assert.doesNotThrow(() => {
      Object.freeze(data.charts.sendsByWeek);
      Object.freeze(data.charts.subscriberHealth);
      Object.freeze(data.charts.automationTriggersByDay);
      Object.freeze(data.charts.engagementRates);
    }, "Object.freeze on chart arrays should not throw MobX error");
  });

  it("updates dataEpoch on commit so observers re-render", () => {
    const store = new AnalyticsStore();
    const initialEpoch = store.dataEpoch;

    store.commitPayload(mockAnalytics);
    assert.equal(store.dataEpoch, initialEpoch + 1);

    store.commitPayload(null);
    assert.equal(store.dataEpoch, initialEpoch + 2);
    assert.equal(store.data, null);
  });
});
