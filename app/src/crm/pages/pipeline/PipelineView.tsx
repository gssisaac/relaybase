"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { crmApi, type PipelineColumn } from "@/lib/crm/api";

const STAGE_LABELS: Record<PipelineColumn["stage"], string> = {
  lead: "Lead",
  contacted: "Contacted",
  quoted: "Quoted",
  won: "Won",
  lost: "Lost",
};

const STAGES = Object.keys(STAGE_LABELS) as PipelineColumn["stage"][];

export function PipelineView() {
  const [columns, setColumns] = useState<PipelineColumn[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragging, setDragging] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await crmApi.getPipeline();
      setColumns(data.columns);
    } catch {
      toast.error("Could not load pipeline");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function columnFor(stage: string) {
    return columns.find((c) => c.stage === stage) ?? { stage, count: 0, cards: [] };
  }

  async function moveCard(memberEmail: string, toStage: string) {
    let fromStage: PipelineColumn["stage"] | null = null;
    let movedCard: PipelineColumn["cards"][number] | null = null;
    for (const col of columns) {
      const found = col.cards.find((c) => c.memberEmail === memberEmail);
      if (found) {
        fromStage = col.stage;
        movedCard = found;
        break;
      }
    }
    if (!fromStage || !movedCard || fromStage === toStage) return;

    setColumns((prev) =>
      prev.map((col) => {
        if (col.stage === fromStage) {
          return {
            ...col,
            count: col.count - 1,
            cards: col.cards.filter((c) => c.memberEmail !== memberEmail),
          };
        }
        if (col.stage === toStage) {
          return { ...col, count: col.count + 1, cards: [movedCard!, ...col.cards] };
        }
        return col;
      }),
    );

    try {
      await crmApi.moveCard(memberEmail, { stage: toStage });
    } catch {
      toast.error("Move failed. Try again.");
      void load();
    }
  }

  if (loading) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <h1 className="text-lg font-semibold">Pipeline</h1>
      <div className="grid flex-1 grid-cols-1 gap-3 overflow-x-auto sm:grid-cols-2 lg:grid-cols-5">
        {STAGES.map((stage) => {
          const column = columnFor(stage);
          return (
            <div
              key={stage}
              className={cn(
                "flex min-h-40 flex-col gap-2 rounded-lg border border-border/60 bg-muted/20 p-2",
                dragging ? "outline outline-1 outline-dashed outline-border" : "",
              )}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const memberEmail = e.dataTransfer.getData("text/plain");
                setDragging(null);
                if (memberEmail) void moveCard(memberEmail, stage);
              }}
            >
              <div className="flex items-center justify-between px-1 text-sm font-medium">
                <span>{STAGE_LABELS[stage]}</span>
                <span className="text-muted-foreground">{column.count}</span>
              </div>
              <div className="flex flex-1 flex-col gap-1.5">
                {column.cards.map((card) => (
                  <div
                    key={card.memberEmail}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", card.memberEmail);
                      setDragging(card.memberEmail);
                    }}
                    onDragEnd={() => setDragging(null)}
                    className="cursor-grab rounded-md border border-border/60 bg-background p-2 text-xs shadow-sm active:cursor-grabbing"
                  >
                    <p className="truncate font-medium text-foreground">
                      {card.name || card.email}
                    </p>
                    <p className="truncate text-muted-foreground">{card.email}</p>
                    {card.note ? (
                      <p className="mt-1 truncate text-muted-foreground">{card.note}</p>
                    ) : null}
                  </div>
                ))}
                {column.count > 50 ? (
                  <a
                    href="/crm/audience"
                    className="px-1 text-xs text-muted-foreground underline"
                  >
                    Show more ({column.count - 50})
                  </a>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
