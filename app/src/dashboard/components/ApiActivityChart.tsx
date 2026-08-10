"use client";

type SeriesPoint = {
  value: number;
  label: string;
};

export function ApiActivityChart({
  requests,
  errors,
  range,
}: {
  requests: SeriesPoint[];
  errors: SeriesPoint[];
  range: "24h" | "7d" | "30d";
}) {
  if (requests.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No API usage recorded for this period.
      </p>
    );
  }

  const max = Math.max(
    1,
    ...requests.map((point) => point.value),
    ...errors.map((point) => point.value),
  );
  const totalRequests = requests.reduce((sum, point) => sum + point.value, 0);
  const totalErrors = errors.reduce((sum, point) => sum + point.value, 0);
  const labelEvery =
    range === "24h" ? 4 : range === "30d" ? 5 : 1;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {totalRequests.toLocaleString()} API requests ·{" "}
          {totalErrors.toLocaleString()} errors
        </p>
        <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-sky-500" aria-hidden />
            Requests
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-violet-500" aria-hidden />
            Errors
          </span>
        </div>
      </div>
      <div className="overflow-x-auto pb-4">
        <div
          className="flex items-end"
          style={{
            gap: 10,
            width: "max-content",
          }}
        >
          {requests.map((point, index) => {
            const errorValue = errors[index]?.value ?? 0;
            const requestH = Math.max(
              point.value > 0 ? 2 : 0,
              Math.round((point.value / max) * 128),
            );
            const errorH = Math.max(
              errorValue > 0 ? 2 : 0,
              Math.round((errorValue / max) * 128),
            );
            const showLabel =
              index % labelEvery === 0 || index === requests.length - 1;

            return (
              <div
                key={`${point.label}-${index}`}
                className="group flex w-5 shrink-0 flex-col items-center gap-1"
                title={`${point.label}: ${point.value} requests, ${errorValue} errors`}
              >
                <div className="relative flex h-32 w-[10px] flex-col items-center justify-end">
                  <div
                    className="w-full rounded-t-sm bg-sky-500/90 transition-opacity group-hover:opacity-80"
                    style={{ height: requestH }}
                  />
                  {errorH > 0 ? (
                    <div
                      className="absolute bottom-0 w-full rounded-t-sm bg-violet-500/90"
                      style={{ height: errorH }}
                    />
                  ) : null}
                </div>
                <div className="flex h-8 w-full items-end justify-start overflow-visible pl-0.5">
                  {showLabel ? (
                    <span className="inline-block origin-bottom-left -rotate-45 whitespace-nowrap text-[9px] leading-none text-muted-foreground">
                      {point.label}
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
