import { renderEmailHtml } from "../layout";
import { FROM } from "../theme";
import type { FormattedEmail } from "../types";

export function betaWelcome(): FormattedEmail {
  const sender = FROM.beta;
  const title = "Welcome to the beta";
  const paragraphs = [
    "Thanks for signing up. Your personal Mac app download link is on its way in a separate email — that link is unique to you.",
    "Relaybase is a Worker you install on your own Cloudflare account. We do not host your mail.",
  ];

  return {
    from: sender.address,
    fromName: sender.name,
    subject: "Welcome to the Relaybase beta",
    text: [
      "Welcome to the Relaybase beta.",
      "",
      ...paragraphs,
      "",
      "— Relaybase",
    ].join("\n"),
    html: renderEmailHtml({
      preview:
        "Thanks for signing up. Your personal Mac app download is on the way.",
      title,
      paragraphs,
    }),
  };
}
