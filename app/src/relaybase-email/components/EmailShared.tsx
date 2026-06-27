"use client";

import Link from "next/link";

import { AlertCircle, Check } from "lucide-react";
import { useMemo } from "react";

import { sanitizeEmailHtml } from "@/lib/email/parse-raw";

import type { InboundAttachment } from "@/relaybase-email/components/types";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
export { PageLoadingOverlay } from "@/components/ui/page-loading-overlay";

export function StatusBadge({
  ok,
  labelOk,
  labelBad,
}: {
  ok: boolean;
  labelOk: string;
  labelBad: string;
}) {
  return (
    <Badge variant={ok ? "default" : "secondary"}>
      {ok ? labelOk : labelBad}
    </Badge>
  );
}

const URL_IN_LINE =
  /(https?:\/\/[^\s]+|\/products\/[^\s]+)/g;

function linkifyTextPart(text: string, keyPrefix: string) {
  const parts = text.split(URL_IN_LINE);
  return parts.map((part, i) => {
    if (/^https?:\/\//.test(part)) {
      return (
        <a
          key={`${keyPrefix}-${i}`}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium underline break-all"
        >
          {part}
        </a>
      );
    }
    if (part.startsWith("/products/")) {
      return (
        <Link
          key={`${keyPrefix}-${i}`}
          href={part}
          className="font-medium underline break-all"
        >
          {part}
        </Link>
      );
    }
    return part;
  });
}

export function InboundEmailBody({
  bodyText,
  bodyHtml,
}: {
  bodyText: string;
  bodyHtml?: string;
}) {
  const safeHtml = useMemo(
    () => (bodyHtml ? sanitizeEmailHtml(bodyHtml) : ""),
    [bodyHtml],
  );

  if (safeHtml) {
    return (
      <div
        className="email-html-body w-full font-sans text-sm leading-relaxed text-foreground [&_*]:!bg-transparent [&_*]:!font-[inherit] [&_*]:text-inherit [&_a]:text-primary [&_a]:underline [&_img]:max-w-full [&_img]:rounded-md"
        dangerouslySetInnerHTML={{ __html: safeHtml }}
      />
    );
  }

  return (
    <p className="w-full whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground">
      {bodyText}
    </p>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function rewriteInlineAttachmentUrls(
  html: string,
  attachments: InboundAttachment[],
  attachmentBaseUrl: string,
): string {
  let next = html;
  for (const attachment of attachments) {
    if (!attachment.contentId) continue;
    const url = `${attachmentBaseUrl}/${encodeURIComponent(attachment.id)}`;
    next = next.replaceAll(`cid:${attachment.contentId}`, url);
    next = next.replaceAll(`cid:${encodeURIComponent(attachment.contentId)}`, url);
  }
  return next;
}

export function InboundEmailDetail({
  productId,
  messageKey,
  bodyText,
  bodyHtml,
  attachments = [],
}: {
  productId: string;
  messageKey: string;
  bodyText: string;
  bodyHtml?: string | null;
  attachments?: InboundAttachment[];
}) {
  const attachmentBaseUrl = `/api/products/${productId}/email/inbox/${encodeURIComponent(messageKey)}/attachments`;

  const safeHtml = useMemo(() => {
    if (!bodyHtml) return "";
    const withInline = rewriteInlineAttachmentUrls(bodyHtml, attachments, attachmentBaseUrl);
    return sanitizeEmailHtml(withInline);
  }, [attachmentBaseUrl, attachments, bodyHtml]);

  const imageAttachments = attachments.filter((attachment) =>
    attachment.contentType.startsWith("image/"),
  );
  const fileAttachments = attachments.filter(
    (attachment) => !attachment.contentType.startsWith("image/"),
  );

  return (
    <div className="space-y-4">
      {safeHtml ? (
        <div
          className="email-html-body w-full rounded-md border border-border bg-muted/20 p-4 font-sans text-sm leading-relaxed text-foreground [&_*]:!bg-transparent [&_*]:!font-[inherit] [&_*]:text-inherit [&_a]:text-primary [&_a]:underline [&_img]:my-2 [&_img]:max-w-full [&_img]:rounded-md"
          dangerouslySetInnerHTML={{ __html: safeHtml }}
        />
      ) : (
        <div className="rounded-md border border-border bg-muted/20 p-4">
          <p className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground">
            {bodyText || "(empty message)"}
          </p>
        </div>
      )}

      {attachments.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-sm font-medium">
            Attachments ({attachments.length})
          </h3>
          {imageAttachments.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {imageAttachments.map((attachment) => {
                const url = `${attachmentBaseUrl}/${encodeURIComponent(attachment.id)}`;
                return (
                  <a
                    key={attachment.id}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block overflow-hidden rounded-md border border-border bg-muted/20"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt={attachment.filename}
                      className="max-h-80 w-full object-contain bg-background"
                    />
                    <div className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
                      {attachment.filename} · {formatFileSize(attachment.size)}
                    </div>
                  </a>
                );
              })}
            </div>
          ) : null}
          {fileAttachments.length > 0 ? (
            <ul className="divide-y divide-border rounded-md border border-border">
              {fileAttachments.map((attachment) => {
                const url = `${attachmentBaseUrl}/${encodeURIComponent(attachment.id)}`;
                return (
                  <li key={attachment.id}>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between gap-3 px-3 py-2 text-sm hover:bg-muted/40"
                    >
                      <span className="truncate font-medium">{attachment.filename}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatFileSize(attachment.size)}
                      </span>
                    </a>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function FormattedErrorText({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-1.5 text-sm">
      {lines.map((line, i) =>
        line.trim() === "" ? (
          <div key={i} className="h-1" aria-hidden />
        ) : (
          <p key={i} className="leading-relaxed">
            {linkifyTextPart(line, `line-${i}`)}
          </p>
        ),
      )}
    </div>
  );
}

export function EmailAlerts({
  error,
  message,
}: {
  error: string | null;
  message: string | null;
}) {
  return (
    <>
      {error ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            <FormattedErrorText text={error} />
          </AlertDescription>
        </Alert>
      ) : null}
      {message ? (
        <Alert>
          <Check className="size-4" />
          <AlertTitle>Success</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}
    </>
  );
}

export function RelaybaseConfigAlert({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <Alert>
      <AlertTitle>Relaybase not configured</AlertTitle>
      <AlertDescription>
        Sign out and sign in again to refresh your session token, or contact
        your operator if the problem persists.
      </AlertDescription>
    </Alert>
  );
}

export function CloudflareConfigAlert({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <Alert>
      <AlertTitle>Cloudflare not configured</AlertTitle>
      <AlertDescription>
        Email Sending and DNS are managed in Relaybase. Contact your operator if
        domain onboarding fails.
      </AlertDescription>
    </Alert>
  );
}

/** @deprecated Use RelaybaseConfigAlert */
export const AwsConfigAlert = RelaybaseConfigAlert;

export function InboundR2ConfigAlert({
  config,
}: {
  config: {
    inboundR2Configured?: boolean;
    inboundR2WorkerConfigured?: boolean;
    inboundR2WorkerReady?: boolean;
    inboundR2Mismatch?: boolean;
    inboundR2BucketName?: string;
    inboundR2WorkerBucketName?: string | null;
    inboundR2BucketExists?: boolean;
  } | null;
}) {
  if (!config || config.inboundR2Configured) return null;

  if (!config.inboundR2WorkerConfigured) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Inbound R2 not configured</AlertTitle>
        <AlertDescription>
          Relaybase worker is not reachable. Ask your operator to finish inbound
          R2 setup in Relaybase before receiving mail.
        </AlertDescription>
      </Alert>
    );
  }
  if (!config.inboundR2BucketExists) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Inbound R2 bucket missing</AlertTitle>
        <AlertDescription>
          R2 bucket{" "}
          <span className="font-mono">{config.inboundR2BucketName}</span> does not
          exist. Ask your operator to provision inbound R2 in Relaybase.
        </AlertDescription>
      </Alert>
    );
  }
  if (config.inboundR2Mismatch) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Inbound R2 bucket mismatch</AlertTitle>
        <AlertDescription>
          Settings use{" "}
          <span className="font-mono">{config.inboundR2BucketName}</span> but the
          worker is bound to{" "}
          <span className="font-mono">{config.inboundR2WorkerBucketName}</span>.
          Update <span className="font-mono">wrangler.toml</span>{" "}
          <span className="font-mono">bucket_name</span> and{" "}
          <span className="font-mono">INBOUND_BUCKET_NAME</span>, then redeploy
          Relaybase.
        </AlertDescription>
      </Alert>
    );
  }
  if (!config.inboundR2WorkerReady) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Worker cannot access inbound R2</AlertTitle>
        <AlertDescription>
          The R2 bucket exists but the worker binding is not working. Enable R2 on
          your Cloudflare account, confirm{" "}
          <span className="font-mono">{config.inboundR2BucketName}</span> is bound
          in <span className="font-mono">wrangler.toml</span>, and redeploy
          Relaybase.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert variant="destructive">
      <AlertTitle>Inbound R2 not configured</AlertTitle>
      <AlertDescription>
        Ask your operator to provision the inbound R2 bucket in Relaybase.
      </AlertDescription>
    </Alert>
  );
}

export function PageToolbar({
  refreshing,
  loading,
  onRefresh,
  cacheHint,
}: {
  refreshing?: boolean;
  /** @deprecated use refreshing */
  loading?: boolean;
  onRefresh: () => void;
  cacheHint?: string | null;
}) {
  const spin = refreshing ?? loading ?? false;
  return (
    <div className="flex items-center justify-end gap-3">
      {cacheHint ? (
        <span className="text-xs text-muted-foreground">{cacheHint}</span>
      ) : null}
      <Button variant="outline" size="sm" onClick={onRefresh} disabled={spin}>
        <i
          className={`ti ti-refresh text-base ${spin ? "animate-spin" : ""}`}
          aria-hidden
        />
        Refresh
      </Button>
    </div>
  );
}
