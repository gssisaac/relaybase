"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Renders untrusted HTML email content inside a sandboxed <iframe> so the
 * email's <style> blocks cannot leak into the app shell (inbox list, title
 * bar, etc.) and vice-versa.
 *
 * - sandbox="allow-same-origin" (no allow-scripts): blocks script execution
 *   while still permitting same-origin blob:/api image URLs to load.
 * - Height auto-fits the content via a ResizeObserver on the iframe document.
 * - A minimal base stylesheet is prepended so emails without their own
 *   background render readably; emails that ship their own <style> win.
 */
export function EmailHtmlFrame({
  html,
  className,
}: {
  html: string;
  className?: string;
}) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [height, setHeight] = useState<number>(200);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    let cancelled = false;
    let ro: ResizeObserver | null = null;
    const timers: number[] = [];

    const measure = () => {
      if (cancelled) return;
      const doc = iframe.contentDocument;
      if (!doc || !doc.body) return;
      const h = Math.ceil(
        Math.max(doc.body.scrollHeight, doc.documentElement.scrollHeight, 0),
      );
      if (h > 0) setHeight((prev) => (prev !== h ? h : prev));
    };

    const onLoad = () => {
      if (cancelled) return;
      const doc = iframe.contentDocument;
      if (!doc || !doc.head) return;

      // Force links to open in a new tab (email links should never navigate
      // the app window).
      const base = doc.createElement("base");
      base.target = "_blank";
      doc.head.appendChild(base);

      // Sensible defaults. Prepended so the email's own <style> (if any)
      // already in the document head wins over these.
      const style = doc.createElement("style");
      style.textContent = BASE_EMAIL_CSS;
      doc.head.insertBefore(style, doc.head.firstChild);

      measure();

      try {
        ro = new ResizeObserver(() => measure());
        ro.observe(doc.body);
        doc.querySelectorAll("img").forEach((img) => {
          if (!(img as HTMLImageElement).complete) {
            img.addEventListener("load", measure, { once: true });
            img.addEventListener("error", measure, { once: true });
          }
        });
      } catch {
        // ResizeObserver unavailable — fall back to timed re-measures.
      }

      // Catch late layout shifts (web fonts, lazy images).
      [100, 300, 800, 1500, 3000].forEach((t) => {
        timers.push(window.setTimeout(measure, t));
      });
    };

    iframe.addEventListener("load", onLoad);
    return () => {
      cancelled = true;
      iframe.removeEventListener("load", onLoad);
      ro?.disconnect();
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [html]);

  return (
    <iframe
      ref={iframeRef}
      title="Email content"
      srcDoc={html}
      sandbox="allow-same-origin"
      className={className}
      style={{
        width: "100%",
        height,
        border: 0,
        display: "block",
        background: "#ffffff",
        colorScheme: "light",
      }}
    />
  );
}

const BASE_EMAIL_CSS = `
  html, body { margin: 0; padding: 0; }
  body {
    background: #ffffff;
    color: #111111;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    font-size: 14px;
    line-height: 1.5;
    word-wrap: break-word;
  }
  img { max-width: 100%; height: auto; }
  table { max-width: 100%; }
  a { color: #2563eb; }
`;
