import { renderEmailHtml } from "../layout";
import { FROM } from "../theme";
import type { FormattedEmail } from "../types";

export function betaDownload(downloadUrl: string): FormattedEmail {
  const sender = FROM.beta;

  return {
    from: sender.address,
    fromName: sender.name,
    subject: "Your Relaybase beta download",
    text: [
      "Here is your personal Relaybase beta download.",
      "",
      "Download the Mac app:",
      downloadUrl,
      "",
      "This link is unique to you. Keep it private.",
      "",
      "— Relaybase",
    ].join("\n"),
    html: renderEmailHtml({
      preview: "Your personal Mac app download is ready.",
      title: "Your Mac app download",
      paragraphs: ["Here is your personal Relaybase beta download."],
      action: { label: "Download the Mac app", href: downloadUrl },
      fallbackHref: downloadUrl,
      footnote: "This link is unique to you. Keep it private.",
    }),
  };
}
