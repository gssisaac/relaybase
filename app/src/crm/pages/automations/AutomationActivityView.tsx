"use client";

import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { crmApi, type AutomationSend, type AutomationTriggerEvent } from "@/lib/crm/api";
import { useAutomationDetail } from "@/crm/pages/automations/AutomationDetailContext";

function formatWhen(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function AutomationActivityView() {
  const { automationId } = useAutomationDetail();
  const [events, setEvents] = useState<AutomationTriggerEvent[]>([]);
  const [sends, setSends] = useState<AutomationSend[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    crmApi
      .getAutomationActivity(automationId)
      .then((res) => {
        if (cancelled) return;
        setEvents(res.triggerEvents);
        setSends(res.sends);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [automationId]);

  if (loading) {
    return <p className="p-4 text-sm text-muted-foreground">Loading activity…</p>;
  }

  return (
    <div className="space-y-8 p-4">
      <section>
        <h2 className="mb-3 text-sm font-semibold">Trigger events</h2>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No events yet.</p>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border">
            {events.map((ev) => (
              <li key={ev.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                <span className="font-medium">{ev.recipientEmail || "—"}</span>
                <Badge variant="outline" className="text-[10px] capitalize">
                  {ev.status}
                </Badge>
                {ev.skipReason ? (
                  <span className="text-xs text-muted-foreground">{ev.skipReason}</span>
                ) : null}
                <span className="ml-auto text-xs text-muted-foreground">
                  {formatWhen(ev.occurredAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold">Sends</h2>
        {sends.length === 0 ? (
          <p className="text-sm text-muted-foreground">No sends yet.</p>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border">
            {sends.map((send) => (
              <li key={send.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                <span className="font-medium">{send.email}</span>
                <Badge variant="outline" className="text-[10px] capitalize">
                  {send.status}
                </Badge>
                {send.openCount > 0 ? (
                  <span className="text-xs text-muted-foreground">{send.openCount} opens</span>
                ) : null}
                {send.clickCount > 0 ? (
                  <span className="text-xs text-muted-foreground">{send.clickCount} clicks</span>
                ) : null}
                <span className="ml-auto text-xs text-muted-foreground">
                  {formatWhen(send.sentAt ?? send.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
