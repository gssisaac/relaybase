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

import { applyGmailContentLinkStyles } from "@/lib/markdown-editor/utils/editor-markdown";
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
export function NewsletterEmailPreview({
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
  const gmailBodyHtml = applyGmailContentLinkStyles(bodyHtml);

  const pane = (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-white text-[#202124]">
          <div
            className={cn(
              "shrink-0 border-b border-[#e0e0e0] px-4 pb-3",
              device === "mobile" ? "pt-12" : "pt-4",
            )}
          >
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
              "min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain bg-white",
              previewIsPlainText && "px-4 py-5",
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
                  // Gmail `.ii a[href]` — Tailwind preflight otherwise paints links as body text.
                  "[&_a[href]]:text-[#1155cc] [&_a[href]]:underline",
                  "[&_a[href]:visited]:text-[#1155cc] [&_a[href]:hover]:text-[#1155cc]",
                  device === "mobile" &&
                    "[&_table]:box-border [&_table]:max-w-full [&_table[width='600']]:!w-full",
                )}
                dangerouslySetInnerHTML={{ __html: gmailBodyHtml }}
              />
            )}
          </div>
        </div>
  );

  if (device === "mobile") {
    return (
      <div
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-neutral-950"
        style={{ colorScheme: "light" }}
      >
        <div className="flex min-h-full items-center justify-center p-6 sm:p-8">
          <div
            className="relative w-[min(390px,calc(100%-2rem))] shrink-0 aspect-[390/844] rounded-[2.75rem] border border-[#3f3f46] bg-[#18181b] p-[11px] shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_12px_40px_rgba(0,0,0,0.55),0_40px_100px_rgba(0,0,0,0.75),0_64px_160px_rgba(0,0,0,0.65)]"
            role="img"
            aria-label="Mobile preview frame"
          >
            <div
              className="pointer-events-none absolute left-1/2 top-[14px] z-20 h-[26px] w-[96px] -translate-x-1/2 rounded-full bg-black shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
              aria-hidden
            />
            <div className="absolute inset-[11px] flex flex-col overflow-hidden rounded-[2.15rem] bg-white">
              {pane}
            </div>
            <div
              className="pointer-events-none absolute bottom-[14px] left-1/2 z-20 h-1 w-[34%] max-w-[128px] -translate-x-1/2 rounded-full bg-white/35"
              aria-hidden
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-[#f6f8fc] text-[#202124]"
      style={{ colorScheme: "light" }}
    >
      <div className="mx-auto flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden">
        {pane}
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
