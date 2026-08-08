"use client";

import { CheckCircle2, Loader2, X, XCircle } from "lucide-react";

import { useDomain } from "@/lib/dashboard/DomainContext";
import type { DomainProgressCard } from "@/lib/dashboard/domain-store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function statusIcon(status: DomainProgressCard["status"]) {
  switch (status) {
    case "done":
      return <CheckCircle2 className="size-3.5 shrink-0 text-emerald-600" />;
    case "failed":
      return <XCircle className="size-3.5 shrink-0 text-destructive" />;
    case "waiting":
      return (
        <Loader2 className="size-3.5 shrink-0 animate-spin text-amber-600" />
      );
    default:
      return (
        <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
      );
  }
}

function overallStatus(
  cards: DomainProgressCard[],
): DomainProgressCard["status"] {
  if (cards.some((c) => c.status === "running" || c.status === "waiting")) {
    return cards.some((c) => c.status === "waiting") ? "waiting" : "running";
  }
  if (cards.some((c) => c.status === "failed")) return "failed";
  return "done";
}

function overallLabel(cards: DomainProgressCard[]): string {
  const running = cards.filter(
    (c) => c.status === "running" || c.status === "waiting",
  ).length;
  const done = cards.filter((c) => c.status === "done").length;
  const failed = cards.filter((c) => c.status === "failed").length;
  if (running > 0) {
    return `Setting up ${cards.length} domain${cards.length === 1 ? "" : "s"} · ${done + failed}/${cards.length} finished`;
  }
  if (failed > 0 && done > 0) {
    return `${done} ready · ${failed} failed`;
  }
  if (failed > 0) {
    return `${failed} domain${failed === 1 ? "" : "s"} failed`;
  }
  return `${done} domain${done === 1 ? "" : "s"} ready`;
}

/**
 * Single compact progress card listing every in-flight / recent domain job.
 */
export function DomainProgressBanner() {
  const store = useDomain();
  const cards = store.progressCards;
  if (!cards.length) return null;

  const status = overallStatus(cards);

  return (
    <div className="shrink-0 select-none border-b border-border bg-muted/40 px-4 py-2">
      <div
        className={cn(
          "flex w-full items-start gap-3 rounded-md border border-border bg-background px-3 py-2",
          status === "failed" && "border-destructive/40",
          status === "done" && "border-emerald-600/30",
        )}
      >
        <div className="mt-0.5">{statusIcon(status)}</div>
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-medium">{overallLabel(cards)}</p>
            {status === "running" || status === "waiting" ? (
              <Badge variant="secondary" className="text-[10px]">
                In progress
              </Badge>
            ) : status === "failed" ? (
              <Badge variant="destructive" className="text-[10px]">
                Failed
              </Badge>
            ) : (
              <Badge className="text-[10px]">Ready</Badge>
            )}
          </div>
          <ul className="space-y-0.5">
            {cards.map((card) => (
              <li
                key={card.key}
                className="flex min-w-0 items-center gap-2 text-xs"
              >
                {statusIcon(card.status)}
                <span className="shrink-0 font-mono font-medium">
                  {card.domain}
                </span>
                <span
                  className={cn(
                    "min-w-0 truncate",
                    card.status === "failed"
                      ? "text-destructive"
                      : "text-muted-foreground",
                  )}
                >
                  {card.status === "done"
                    ? card.description
                    : [
                        card.description,
                        card.onboarding?.currentStepLabel &&
                        (card.status === "running" || card.status === "waiting")
                          ? card.onboarding.currentStepLabel
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 w-6 shrink-0 p-0"
          onClick={() => store.dismissAllProgress()}
          aria-label="Dismiss"
        >
          <X className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
