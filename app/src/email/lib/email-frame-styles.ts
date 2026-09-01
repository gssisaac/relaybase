/** System stack when parent computed font is unavailable (SSR / tests). */
export const EMAIL_FRAME_FONT_FALLBACK =
  'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

/** Copy @font-face rules from the app shell so Inter loads inside the iframe. */
export function collectParentFontFaceCss(): string {
  if (typeof document === "undefined") return "";
  const rules: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      for (const rule of Array.from(sheet.cssRules)) {
        if (rule instanceof CSSFontFaceRule) {
          rules.push(rule.cssText);
        }
      }
    } catch {
      // Cross-origin stylesheets are not readable.
    }
  }
  return rules.join("\n");
}

/** Resolved app font stack (Inter via next/font on the shell body). */
export function getAppFontFamily(): string {
  if (typeof document === "undefined") return EMAIL_FRAME_FONT_FALLBACK;
  const fromBody = getComputedStyle(document.body).fontFamily;
  if (fromBody) return fromBody;
  const fromRoot = getComputedStyle(document.documentElement).fontFamily;
  return fromRoot || EMAIL_FRAME_FONT_FALLBACK;
}

export function buildEmailFrameFontCss(fontFamily = getAppFontFamily()): string {
  return `
html, body {
  font-family: ${fontFamily} !important;
  font-size: 14px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
font {
  font-family: inherit !important;
}
`.trim();
}

/** Styles injected into srcDoc before first paint. */
export function buildEmailFrameInjectedHead(): string {
  const faces = collectParentFontFaceCss();
  const fontCss = buildEmailFrameFontCss();
  const css = faces ? `${faces}\n${fontCss}` : fontCss;
  return `<style>${css}</style>`;
}

/** Wrap a MIME HTML fragment (or full document) for iframe srcDoc. */
export function wrapEmailSrcDoc(html: string, injectedHead: string): string {
  const trimmed = html.trim();
  if (/^\s*<!doctype/i.test(trimmed) || /^\s*<html[\s>]/i.test(trimmed)) {
    if (/<\/head>/i.test(trimmed)) {
      return trimmed.replace(/<\/head>/i, `${injectedHead}</head>`);
    }
    if (/<head[\s>]/i.test(trimmed)) {
      return trimmed.replace(/<head([^>]*)>/i, `<head$1>${injectedHead}`);
    }
    return trimmed.replace(
      /<html([^>]*)>/i,
      `<html$1><head>${injectedHead}</head>`,
    );
  }
  return `<!DOCTYPE html><html><head>${injectedHead}</head><body>${html}</body></html>`;
}
