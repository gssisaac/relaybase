"use client";

import { CheckCircle2, Loader2, X, XCircle } from "lucide-react";

import { useDomain } from "@/lib/dashboard/DomainContext";
import type { DomainProgressCard } from "@/lib/dashboard/domain-store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

function statusIcon(status: DomainProgressCard["status"]) {
  switch (status) {
    case "done":
      return <CheckCircle2 className="size-4 text-emerald-600" />;
    case "failed":
      return <XCircle className="size-4 text-destructive" />;
    case "waiting":
      return <Loader2 className="size-4 animate-spin text-amber-600" />;
    default:
      return <Loader2 className="size-4 animate-spin text-muted-foreground" />;
  }
}

function statusBadge(status: DomainProgressCard["status"]) {
  switch (status) {
    case "done":
      return <Badge className="text-[10px]">Ready</Badge>;
    case "failed":
      return (
        <Badge variant="destructive" className="text-[10px]">
          Failed
        </Badge>
      );
    case "waiting":
      return (
        <Badge variant="outline" className="text-[10px]">
          Waiting for DNS
        </Badge>
      );
    default:
      return (
        <Badge variant="secondary" className="text-[10px]">
          In progress
        </Badge>
      );
  }
}

export function DomainProgressBanner() {
  const store = useDomain();
  const cards = store.progressCards;
  if (!cards.length) return null;

  return (
    <div className="shrink-0 space-y-2 border-b border-border bg-muted/30 px-4 py-3">
      <div className="mx-auto w-full max-w-[1200px] space-y-2">
        {cards.map((card) => (
          <Card
            key={card.key}
            className={cn(
              "shadow-none",
              card.status === "failed" && "border-destructive/40",
              card.status === "done" && "border-emerald-600/30",
            )}
          >
            <CardContent className="flex items-start gap-3 py-3">
              <div className="mt-0.5 shrink-0">{statusIcon(card.status)}</div>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-mono text-sm font-medium">{card.title}</p>
                  {statusBadge(card.status)}
                </div>
                <p
                  className={cn(
                    "text-xs",
                    card.status === "failed"
                      ? "text-destructive"
                      : "text-muted-foreground",
                  )}
                >
                  {card.description}
                </p>
                {card.onboarding?.steps?.length &&
                (card.status === "running" || card.status === "waiting") ? (
                  <p className="text-[11px] text-muted-foreground">
                    Step{" "}
                    {card.onboarding.steps.filter(
                      (s) => s.status === "succeeded",
                    ).length + 1}
                    /{card.onboarding.steps.length}
                    {card.onboarding.currentStepLabel
                      ? ` · ${card.onboarding.currentStepLabel}`
                      : ""}
                  </p>
                ) : null}
              </div>
              {card.dismissible && card.jobId ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 shrink-0 p-0"
                  onClick={() => store.dismissJob(card.jobId!)}
                  aria-label="Dismiss"
                >
                  <X className="size-3.5" />
                </Button>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
