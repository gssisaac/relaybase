"use client";

import { ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";

import {
  desktopOpenExternal,
  type DesktopErrorHelp,
} from "@/lib/desktop/bridge";

function ActionLink({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  const router = useRouter();
  const external = href.startsWith("http://") || href.startsWith("https://");
  const className =
    "inline-flex items-center gap-1 text-left text-xs font-medium text-brand hover:underline";

  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        if (external) {
          void desktopOpenExternal(href);
          return;
        }
        router.push(href);
      }}
    >
      {label}
      {external ? <ExternalLink className="size-3 shrink-0" /> : null}
    </button>
  );
}

export function DesktopErrorBanner({
  error,
  hideLinks = false,
}: {
  error: DesktopErrorHelp | string | null;
  hideLinks?: boolean;
}) {
  if (!error) return null;

  const help: DesktopErrorHelp =
    typeof error === "string"
      ? {
          title: "Error",
          detail: error,
          fix: "Try again after fixing the cause.",
        }
      : error;

  return (
    <div className="space-y-2.5 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">
      <p className="font-medium text-destructive">{help.title}</p>
      {help.detail ? (
        <p className="text-sm leading-relaxed text-foreground/90">
          {help.detail}
        </p>
      ) : null}
      {help.permissions && help.permissions.length > 0 ? (
        <div className="rounded-md border border-border/80 bg-background/60 px-3 py-2">
          <p className="text-xs font-medium text-foreground">
            Required API token permissions
          </p>
          <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
            {help.permissions.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <p className="text-xs leading-relaxed text-muted-foreground">
        <span className="font-medium text-foreground">What to do: </span>
        {help.fix}
      </p>
      {!hideLinks && help.links && help.links.length > 0 ? (
        <div className="flex flex-col gap-1.5 pt-0.5 sm:flex-row sm:flex-wrap sm:gap-x-4">
          {help.links.map((link) => (
            <ActionLink
              key={link.href + link.label}
              href={link.href}
              label={link.label}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
