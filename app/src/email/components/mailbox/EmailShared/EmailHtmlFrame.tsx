"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  buildEmailFrameFontCss,
  buildEmailFrameInjectedHead,
  collectParentFontFaceCss,
  getAppFontFamily,
  wrapEmailSrcDoc,
} from "@/email/lib/email-frame-styles";
import { desktopOpenExternal } from "@/lib/desktop/bridge";

/**
 * Renders untrusted HTML email content inside a sandboxed <iframe> so the
 * email's <style> blocks cannot leak into the app shell (inbox list, title
 * bar, etc.) and vice-versa.
 *
 * - sandbox="allow-same-origin allow-popups" (no allow-scripts): blocks
 *   script execution while still permitting same-origin blob:/api image URLs
 *   to load. allow-popups lets target="_blank" work as a fallback in regular
 *   browsers; inside the Tauri webview a click interceptor routes links to
 *   the OS browser via the open_external_url command (window.open is blocked).
 * - Height auto-fits the content via a ResizeObserver on the iframe document
 *   so the detail pane is the only vertical scroller (no iframe scrollbar).
 * - A minimal base stylesheet is prepended so emails without their own
 *   background render readably; emails that ship their own <style> win,
 *   except overflow/height which we force last so marketing mail cannot
 *   create a nested scroll viewport.
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
  const srcDoc = useMemo(
    () => wrapEmailSrcDoc(html, buildEmailFrameInjectedHead()),
    [html],
  );

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    let cancelled = false;
    let ro: ResizeObserver | null = null;
    const timers: number[] = [];
    let clickHandler: ((e: MouseEvent) => void) | null = null;
    let setupDone = false;

    const measure = () => {
      if (cancelled) return;
      const doc = iframe.contentDocument;
      if (!doc || !doc.body) return;
      const h = Math.ceil(
        Math.max(doc.body.scrollHeight, doc.documentElement.scrollHeight, 0),
      );
      if (h > 0) setHeight((prev) => (prev !== h ? h : prev));
    };

    const setup = () => {
      if (cancelled || setupDone) return;
      const doc = iframe.contentDocument;
      if (!doc || !doc.head || !doc.body) return;
      setupDone = true;

      // Force links to open in a new tab (email links should never navigate
      // the app window). <base target="_blank"> covers anchors/forms without
      // an explicit target, but some emails set target="_self" or omit it on
      // <form action>; rewrite every link/form explicitly so WKWebView always
      // raises a new-window request that on_new_window (lib.rs) routes to the
      // OS browser. This is DOM mutation from the parent (same-origin), so it
      // works even though the iframe sandbox omits allow-scripts.
      const base = doc.createElement("base");
      base.target = "_blank";
      doc.head.appendChild(base);

      doc.querySelectorAll("a[href]").forEach((a) => {
        a.setAttribute("target", "_blank");
        a.setAttribute("rel", "noopener noreferrer");
      });
      doc.querySelectorAll("form").forEach((f) => {
        f.setAttribute("target", "_blank");
      });

      // Intercept link clicks and route them through desktopOpenExternal so
      // they open in the system browser. The sandbox omits allow-popups, so
      // target="_blank" alone is silently blocked; and inside the Tauri
      // webview, target="_blank" would not reach the OS browser anyway.
      // The explicit target="_blank" rewrite above is the primary mechanism
      // (reliable in WKWebView); this click handler is a secondary net for
      // browsers and for hrefs the new-window path might drop.
      const onClick = (e: MouseEvent) => {
        if (e.defaultPrevented) return;
        const target = e.target;
        if (!(target instanceof Element)) return;
        const anchor = target.closest("a");
        if (!anchor) return;
        const href = anchor.getAttribute("href");
        if (!href) return;
        // Handle absolute http(s) and protocol-relative (//host) links.
        // Resolve protocol-relative against the current origin so the OS
        // browser gets a full URL.
        if (/^https?:\/\//i.test(href)) {
          e.preventDefault();
          e.stopPropagation();
          void desktopOpenExternal(href);
        } else if (href.startsWith("//")) {
          e.preventDefault();
          e.stopPropagation();
          void desktopOpenExternal(`https:${href}`);
        }
      };
      clickHandler = onClick;
      doc.addEventListener("click", onClick, true);

      // Sensible defaults. Prepended so the email's own <style> (if any)
      // already in the document head wins over these.
      const style = doc.createElement("style");
      style.textContent = BASE_EMAIL_CSS;
      doc.head.insertBefore(style, doc.head.firstChild);

      // Appended last so it beats email `html, body { height: 100%; overflow: auto }`
      // rules that otherwise create a second scrollbar inside the iframe.
      const overflowStyle = doc.createElement("style");
      overflowStyle.textContent = FRAME_OVERFLOW_CSS;
      doc.head.appendChild(overflowStyle);

      // Re-copy faces (srcDoc is a fresh document) and force the app font stack
      // over sender defaults (Gmail plain-text HTML, forward headers, etc.).
      const fontFaces = collectParentFontFaceCss();
      if (fontFaces) {
        const faceStyle = doc.createElement("style");
        faceStyle.textContent = fontFaces;
        doc.head.appendChild(faceStyle);
      }
      const fontStyle = doc.createElement("style");
      fontStyle.textContent = buildEmailFrameFontCss(getAppFontFamily());
      doc.head.appendChild(fontStyle);

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

    const onLoad = () => setup();

    iframe.addEventListener("load", onLoad);
    // Belt-and-suspenders: the `load` event for srcDoc can race with the
    // effect in some webviews (WKWebView). Poll briefly until the document
    // is parseable, then attach. setup() is idempotent via setupDone.
    [0, 30, 80, 160, 300, 600].forEach((t) => {
      timers.push(window.setTimeout(setup, t));
    });
    return () => {
      cancelled = true;
      iframe.removeEventListener("load", onLoad);
      const doc = iframe.contentDocument;
      if (clickHandler) doc?.removeEventListener("click", clickHandler, true);
      ro?.disconnect();
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [srcDoc]);

  return (
    <iframe
      ref={iframeRef}
      title="Email content"
      srcDoc={srcDoc}
      sandbox="allow-same-origin allow-popups"
      scrolling="no"
      className={className}
      style={{
        width: "100%",
        height,
        border: 0,
        display: "block",
        overflow: "hidden",
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
    word-wrap: break-word;
  }
  img { max-width: 100%; height: auto; }
  table { max-width: 100%; }
  a { color: #2563eb; }
`;

const FRAME_OVERFLOW_CSS = `
  html, body {
    height: auto !important;
    max-height: none !important;
    overflow: hidden !important;
    scrollbar-width: none;
  }
  html::-webkit-scrollbar, body::-webkit-scrollbar {
    display: none;
    width: 0;
    height: 0;
  }
`;
