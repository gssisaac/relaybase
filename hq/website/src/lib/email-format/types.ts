import type { FROM } from "./theme";

export type EmailSender = (typeof FROM)[keyof typeof FROM];

export type FormattedEmail = {
  from: string;
  fromName: string;
  subject: string;
  text: string;
  html: string;
};

/** Shared card fields every Relaybase email is wrapped in. */
export type EmailCard = {
  preview: string;
  title: string;
  paragraphs: string[];
  action?: { label: string; href: string };
  fallbackHref?: string;
  footnote?: string;
};

export type BetaWelcomeEmail = {
  kind: "beta-welcome";
};

export type BetaDownloadEmail = {
  kind: "beta-download";
  downloadUrl: string;
};

/** Escape hatch for a one-off that still uses the shared card. */
export type CardEmail = EmailCard & {
  kind: "card";
  subject: string;
  text: string;
  sender?: EmailSender;
};

export type EmailKind = BetaWelcomeEmail | BetaDownloadEmail | CardEmail;
