/** Gmail reading-pane default for unstyled content anchors. */
export const GMAIL_LINK_STYLE = "color:#1155cc;text-decoration:underline;";

/**
 * Paint content links the way Gmail actually shows them.
 * Leaves anchors that already set `color` alone (footer unsubscribe, buttons).
 */
export function applyGmailContentLinkStyles(html: string): string {
  return html.replace(/<a\b([^>]*)>/gi, (full, attrs: string) => {
    const styleMatch = attrs.match(/\bstyle\s*=\s*"([^"]*)"/i);
    if (styleMatch && /(?:^|;)\s*color\s*:/i.test(styleMatch[1])) {
      return full;
    }
    if (styleMatch) {
      const merged = styleMatch[1].trim().replace(/;\s*$/, "");
      const next = `${merged};${GMAIL_LINK_STYLE}`;
      return `<a${attrs.replace(/\bstyle\s*=\s*"[^"]*"/i, `style="${next}"`)}>`;
    }
    return `<a${attrs} style="${GMAIL_LINK_STYLE}">`;
  });
}
