"use client";

import {
  ChevronDown,
  ExternalLink,
  MoreVertical,
  Printer,
  Reply,
  Smile,
  Star,
} from "lucide-react";

import { cn } from "@/lib/utils";

function senderInitial(fromName: string | null, fromEmail: string): string {
  const source = fromName?.trim() || fromEmail.trim();
  const ch = source.charAt(0).toUpperCase();
  return /[A-Z0-9]/i.test(ch) ? ch : "?";
}

function formatPreviewTimestamp(): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date());
}

/**
 * Gmail-style reading pane — subject, From/To chrome, then message body.
 * Body uses a light canvas so HTML templates match real inbox rendering.
 */
export function BroadcastEmailPreview({
  subject,
  fromName,
  fromEmail,
  toEmail,
  bodyHtml,
  bodyPlainText,
  previewIsPlainText,
  device,
}: {
  subject: string;
  fromName: string | null;
  fromEmail: string;
  toEmail: string;
  bodyHtml: string;
  bodyPlainText: string;
  previewIsPlainText: boolean;
  device: "desktop" | "mobile";
}) {
  const displayFromName = fromName?.trim() || fromEmail.split("@")[0] || "Sender";
  const displaySubject = subject.trim() || "(No subject)";

  return (
    <div
      className="flex h-full min-h-full flex-1 flex-col bg-[#f6f8fc] text-[#202124]"
      style={{ colorScheme: "light" }}
    >
      <div
        className={cn(
          "mx-auto flex min-h-full w-full flex-1 flex-col",
          device === "mobile" ? "max-w-[375px]" : "max-w-none",
        )}
      >
        <div className="flex min-h-full flex-1 flex-col bg-white">
          <div className="shrink-0 border-b border-[#e0e0e0] px-4 pb-3 pt-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-normal leading-snug tracking-tight">
                    {displaySubject}
                  </h2>
                  <span className="rounded px-1.5 py-0.5 text-[11px] font-medium text-[#5f6368] ring-1 ring-[#dadce0]">
                    Preview
                  </span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-0.5 text-[#5f6368]">
                <span className="sr-only">Message actions (decorative)</span>
                <DecorIcon icon={Printer} label="Print" />
                <DecorIcon icon={ExternalLink} label="Open in new window" />
              </div>
            </div>

            <div className="mt-4 flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-1 gap-3">
                <div
                  className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#1a73e8] text-sm font-medium text-white"
                  aria-hidden
                >
                  {senderInitial(fromName, fromEmail)}
                </div>
                <div className="min-w-0 flex-1 text-sm leading-snug">
                  <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                    <span className="font-medium text-[#202124]">{displayFromName}</span>
                    <span className="text-[#5f6368]">&lt;{fromEmail}&gt;</span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-0.5 text-xs text-[#5f6368]">
                    <span>to me</span>
                    <ChevronDown className="size-3.5 opacity-70" aria-hidden />
                    <span className="truncate text-[#5f6368]/80">({toEmail})</span>
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="whitespace-nowrap text-xs text-[#5f6368]">
                  {formatPreviewTimestamp()}
                </span>
                <div className="flex items-center gap-0.5 text-[#5f6368]">
                  <DecorIcon icon={Star} label="Star" />
                  <DecorIcon icon={Smile} label="Reaction" />
                  <DecorIcon icon={Reply} label="Reply" />
                  <DecorIcon icon={MoreVertical} label="More" />
                </div>
              </div>
            </div>
          </div>

          <div
            className={cn(
              "min-h-0 flex-1 bg-white",
              previewIsPlainText ? "px-4 py-5" : "overflow-x-hidden",
            )}
          >
            {previewIsPlainText ? (
              <pre className="whitespace-pre-wrap break-words font-sans text-[15px] leading-relaxed text-[#202124]">
                {bodyPlainText}
              </pre>
            ) : (
              <div
                className={cn(
                  "w-full [&_p]:my-[0.75em] [&_p:first-child]:mt-0 [&_p:last-child]:mb-0",
                  device === "mobile" &&
                    "[&_table]:box-border [&_table]:max-w-full [&_table[width='600']]:!w-full",
                )}
                dangerouslySetInnerHTML={{ __html: bodyHtml }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DecorIcon({
  icon: Icon,
  label,
}: {
  icon: typeof Star;
  label: string;
}) {
  return (
    <span
      className="inline-flex size-8 items-center justify-center rounded-full text-[#5f6368] opacity-60"
      aria-hidden
      title={label}
    >
      <Icon className="size-4" strokeWidth={1.75} />
    </span>
  );
}
