"use client";

import { useState, type CSSProperties } from "react";

const THEME_CSS = `
:root {
  --next-error-bg: #fff;
  --next-error-text: #171717;
  --next-error-title: #171717;
  --next-error-message: #171717;
  --next-error-digest: #666666;
  --next-error-btn-text: #fff;
  --next-error-btn-bg: #171717;
  --next-error-btn-border: none;
  --next-error-btn-secondary-text: #171717;
  --next-error-btn-secondary-bg: transparent;
  --next-error-btn-secondary-border: 1px solid rgba(0,0,0,0.08);
  --next-error-detail-bg: rgba(0,0,0,0.04);
  --next-error-detail-border: rgba(0,0,0,0.08);
}
@media (prefers-color-scheme: dark) {
  :root {
    --next-error-bg: #0a0a0a;
    --next-error-text: #ededed;
    --next-error-title: #ededed;
    --next-error-message: #ededed;
    --next-error-digest: #a0a0a0;
    --next-error-btn-text: #0a0a0a;
    --next-error-btn-bg: #ededed;
    --next-error-btn-border: none;
    --next-error-btn-secondary-text: #ededed;
    --next-error-btn-secondary-bg: transparent;
    --next-error-btn-secondary-border: 1px solid rgba(255,255,255,0.14);
    --next-error-detail-bg: rgba(255,255,255,0.06);
    --next-error-detail-border: rgba(255,255,255,0.14);
  }
}
body { margin: 0; color: var(--next-error-text); background: var(--next-error-bg); }
`.replace(/\n\s*/g, "");

const styles = {
  container: {
    fontFamily:
      'system-ui,"Segoe UI",Roboto,Helvetica,Arial,sans-serif,"Apple Color Emoji","Segoe UI Emoji"',
    height: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  } satisfies CSSProperties,
  card: {
    marginTop: "-32px",
    maxWidth: "420px",
    width: "100%",
    padding: "32px 28px",
    textAlign: "left",
  } satisfies CSSProperties,
  icon: {
    marginBottom: "24px",
  } satisfies CSSProperties,
  title: {
    fontSize: "24px",
    fontWeight: 500,
    letterSpacing: "-0.02em",
    lineHeight: "32px",
    margin: "0 0 12px 0",
    color: "var(--next-error-title)",
  } satisfies CSSProperties,
  message: {
    fontSize: "14px",
    fontWeight: 400,
    lineHeight: "21px",
    margin: "0 0 20px 0",
    color: "var(--next-error-message)",
  } satisfies CSSProperties,
  buttonGroup: {
    display: "flex",
    gap: "8px",
    alignItems: "center",
  } satisfies CSSProperties,
  button: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    height: "32px",
    padding: "0 12px",
    fontSize: "14px",
    fontWeight: 500,
    lineHeight: "20px",
    borderRadius: "6px",
    cursor: "pointer",
    color: "var(--next-error-btn-text)",
    background: "var(--next-error-btn-bg)",
    border: "var(--next-error-btn-border)",
  } satisfies CSSProperties,
  buttonSecondary: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    height: "32px",
    padding: "0 12px",
    fontSize: "14px",
    fontWeight: 500,
    lineHeight: "20px",
    borderRadius: "6px",
    cursor: "pointer",
    color: "var(--next-error-btn-secondary-text)",
    background: "var(--next-error-btn-secondary-bg)",
    border: "var(--next-error-btn-secondary-border)",
  } satisfies CSSProperties,
  details: {
    marginTop: "20px",
    borderTop: "1px solid var(--next-error-detail-border)",
    paddingTop: "12px",
  } satisfies CSSProperties,
  summary: {
    listStyle: "none",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: 500,
    lineHeight: "20px",
    color: "var(--next-error-digest)",
    display: "flex",
    alignItems: "center",
    gap: "6px",
    userSelect: "none",
  } satisfies CSSProperties,
  summaryMarker: {
    display: "inline-block",
    width: "0",
    height: "0",
    borderLeft: "5px solid transparent",
    borderRight: "5px solid transparent",
    borderTop: "6px solid var(--next-error-digest)",
    transition: "transform 120ms ease",
  } satisfies CSSProperties,
  detailPanel: {
    marginTop: "10px",
    borderRadius: "8px",
    border: "1px solid var(--next-error-detail-border)",
    background: "var(--next-error-detail-bg)",
    padding: "10px",
  } satisfies CSSProperties,
  detailHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
    marginBottom: "8px",
  } satisfies CSSProperties,
  detailLabel: {
    fontSize: "11px",
    fontWeight: 600,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    color: "var(--next-error-digest)",
  } satisfies CSSProperties,
  copyButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    height: "24px",
    padding: "0 8px",
    fontSize: "12px",
    fontWeight: 500,
    borderRadius: "5px",
    cursor: "pointer",
    color: "var(--next-error-btn-secondary-text)",
    background: "var(--next-error-btn-secondary-bg)",
    border: "var(--next-error-btn-secondary-border)",
  } satisfies CSSProperties,
  pre: {
    margin: 0,
    maxHeight: "220px",
    overflow: "auto",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    fontFamily:
      'ui-monospace,SFMono-Regular,"SF Mono",Menlo,Consolas,monospace',
    fontSize: "11px",
    lineHeight: "16px",
    color: "var(--next-error-text)",
  } satisfies CSSProperties,
} as const;

function WarningIcon() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="-0.2 -1.5 32 32"
      fill="none"
      style={styles.icon}
      aria-hidden
    >
      <path
        d="M16.9328 0C18.0839 0.000116771 19.1334 0.658832 19.634 1.69531L31.4299 26.1309C32.0708 27.4588 31.1036 28.9999 29.6291 29H2.00215C0.527541 29 -0.439628 27.4588 0.201371 26.1309L11.9973 1.69531C12.4979 0.658823 13.5474 7.75066e-05 14.6984 0H16.9328ZM3.59493 26H28.0363L16.9328 3H14.6984L3.59493 26ZM15.8156 19C16.9202 19.0001 17.8156 19.8955 17.8156 21C17.8156 22.1045 16.9202 22.9999 15.8156 23C14.7111 23 13.8156 22.1046 13.8156 21C13.8156 19.8954 14.7111 19 15.8156 19ZM17.3156 16.5H14.3156V8.5H17.3156V16.5Z"
        fill="var(--next-error-title)"
      />
    </svg>
  );
}

export function formatPageLoadErrorDetail(
  error: Error & { digest?: string },
): string {
  const href =
    typeof window !== "undefined" ? window.location.href : "(unknown)";
  const lines = [
    `href: ${href}`,
    `name: ${error.name || "(none)"}`,
    `message: ${error.message || "(none)"}`,
  ];
  if (error.digest) lines.push(`digest: ${error.digest}`);
  if (error.stack) {
    lines.push("", "stack:", error.stack);
  }
  return lines.join("\n");
}

export function PageLoadError({
  error,
  reset,
  includeDocumentShell = false,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  /** When true, wrap with html/body + theme CSS (for global-error). */
  includeDocumentShell?: boolean;
}) {
  const digest = error?.digest;
  const isServerError = !!digest;
  const message = isServerError
    ? "A server error occurred. Reload to try again."
    : "Reload to try again, or go back.";
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const detail = formatPageLoadErrorDetail(error);

  async function copyDetail() {
    try {
      await navigator.clipboard.writeText(detail);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Fallback for restricted clipboard (e.g. some webviews)
      const ta = document.createElement("textarea");
      ta.value = detail;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      } finally {
        document.body.removeChild(ta);
      }
    }
  }

  function goBack() {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    window.location.href = "/";
  }

  const theme = <style dangerouslySetInnerHTML={{ __html: THEME_CSS }} />;

  const body = (
    <div style={styles.container}>
      {!includeDocumentShell ? theme : null}
      <div style={styles.card}>
        <WarningIcon />
        <h1 style={styles.title}>This page couldn&apos;t load</h1>
        <p style={styles.message}>{message}</p>
        <div style={styles.buttonGroup}>
          <button
            type="button"
            style={styles.button}
            onClick={() => {
              if (includeDocumentShell) {
                window.location.reload();
                return;
              }
              reset();
            }}
          >
            Reload
          </button>
          {!isServerError ? (
            <button
              type="button"
              style={styles.buttonSecondary}
              onClick={goBack}
            >
              Back
            </button>
          ) : null}
        </div>

        <div style={styles.details}>
          <button
            type="button"
            style={styles.summary}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <span
              style={{
                ...styles.summaryMarker,
                transform: open ? "rotate(0deg)" : "rotate(-90deg)",
              }}
            />
            Show detail
          </button>
          {open ? (
            <div style={styles.detailPanel}>
              <div style={styles.detailHeader}>
                <span style={styles.detailLabel}>Error</span>
                <button
                  type="button"
                  style={styles.copyButton}
                  onClick={() => void copyDetail()}
                >
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <pre style={styles.pre}>{detail}</pre>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );

  if (!includeDocumentShell) return body;

  return (
    <html lang="en" id="__next_error__">
      <head>{theme}</head>
      <body>{body}</body>
    </html>
  );
}
