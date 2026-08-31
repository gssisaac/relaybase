import { renderEmailHtml } from "./layout";
import { FROM } from "./theme";
import { betaDownload } from "./templates/beta-download";
import { betaWelcome } from "./templates/beta-welcome";
import type {
  EmailCard,
  EmailKind,
  EmailSender,
  FormattedEmail,
} from "./types";

export type {
  CardEmail,
  EmailCard,
  EmailKind,
  EmailSender,
  FormattedEmail,
} from "./types";
export { BRAND, COLOR, FONT, FROM } from "./theme";
export { renderEmailHtml } from "./layout";

/** Wrap any card in the shared Relaybase email chrome. */
export function formatCard(
  card: EmailCard,
  options: {
    subject: string;
    text: string;
    sender?: EmailSender;
  },
): FormattedEmail {
  const sender = options.sender ?? FROM.beta;
  return {
    from: sender.address,
    fromName: sender.name,
    subject: options.subject,
    text: options.text,
    html: renderEmailHtml(card),
  };
}

export function formatEmail(input: EmailKind): FormattedEmail {
  switch (input.kind) {
    case "beta-welcome":
      return betaWelcome();
    case "beta-download":
      return betaDownload(input.downloadUrl);
    case "card":
      return formatCard(input, {
        subject: input.subject,
        text: input.text,
        sender: input.sender,
      });
  }
}
