import type { ReactNode } from "react";

import { siteConfig } from "@/lib/site-config";

export type FaqItem = {
  id: string;
  question: string;
  answer: ReactNode;
};

export type FaqGroup = {
  title: string;
  items: FaqItem[];
};

const googleWorkspaceGuideUrl =
  "/resources/google-workspace-coexistence-and-migration";

export const faqGroups: FaqGroup[] = [
  {
    title: "Google Workspace & Custom Domain Coexistence",
    items: [
      {
        id: "google-workspace-root-domain",
        question:
          "Can I use Relaybase on the same root domain as Google Workspace or Microsoft 365?",
        answer: (
          <>
            <p>
              No, not on the exact same root domain (
              <code>yourcompany.com</code>). DNS Mail Exchange (MX) records
              operate at the domain level, directing all incoming email for a
              domain to a single provider. DNS cannot split incoming traffic by
              username (e.g., routing <code>alex@</code> to Google and{" "}
              <code>support@</code> to Cloudflare).
            </p>
            <p>
              A subdomain of the same zone (for example{" "}
              <code>mail.yourcompany.com</code>) does not work either. To use
              Relaybase, either point a <strong>separate registered domain</strong>{" "}
              at Cloudflare, or <strong>migrate the existing domain</strong> off
              Google Workspace: import past archives into Cloudflare R2 with the
              open-source migration tool, then point root MX records to
              Cloudflare.
            </p>
            <p>
              <a href={googleWorkspaceGuideUrl}>
                Read the full Google Workspace coexistence guide
              </a>
            </p>
          </>
        ),
      },
      {
        id: "google-workspace-migration",
        question: "How do I migrate historical emails if I leave Google Workspace?",
        answer: (
          <>
            <p>
              We built and open-sourced{" "}
              <a
                href="https://github.com/strum-us/relaybase-mbox-migration"
                target="_blank"
                rel="noopener noreferrer"
              >
                <code>relaybase-mbox-migration</code>
              </a>{" "}
              to solve this without third-party data exposure.
            </p>
            <p>
              Unlike SaaS migration services that require giving cloud servers
              your Google admin credentials, our CLI runs{" "}
              <strong>100% locally on your machine</strong>. It streams your
              Google Takeout <code>.mbox</code> export, parses MIME structures
              locally, uploads directly to your Cloudflare R2 bucket (
              <code>relaybase-mailbox</code>), and triggers instant search
              indexing in Cloudflare D1.
            </p>
          </>
        ),
      },
    ],
  },
  {
    title: "Architecture & Data Privacy",
    items: [
      {
        id: "data-custody",
        question: "Does Relaybase have custody of my emails?",
        answer: (
          <>
            <p>
              <strong>Zero data custody.</strong> Relaybase operates no
              multi-tenant mail proxy, central message store, or relay servers.
            </p>
            <p>
              When you install Relaybase, our open-source routing Worker (
              <a
                href={siteConfig.githubWorkerUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <code>strum-us/relaybase-worker</code>
              </a>
              ) deploys directly into <strong>your own Cloudflare account</strong>
              . All raw MIME emails and attachments are stored in your
              Cloudflare R2 bucket, and search indices live in your Cloudflare D1
              databases. Your data never touches Relaybase servers.
            </p>
          </>
        ),
      },
      {
        id: "open-source-worker",
        question: "Is the backend Worker really 100% open source?",
        answer: (
          <p>
            Yes. The entire product Worker is open source under the MIT license
            at{" "}
            <a
              href={siteConfig.githubWorkerUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              github.com/strum-us/relaybase-worker
            </a>
            . You can inspect every line of code, D1 schema, and webhook
            signature before deploying it via Wrangler or the Relaybase Mac app
            installer.
          </p>
        ),
      },
    ],
  },
  {
    title: "Cloudflare Requirements, Security & Pricing",
    items: [
      {
        id: "cloudflare-costs",
        question: "What Cloudflare account requirements and costs are involved?",
        answer: (
          <>
            <p>
              Relaybase connects to Cloudflare&apos;s serverless primitives:{" "}
              <strong>Cloudflare Email Routing</strong>,{" "}
              <strong>Cloudflare Email Sending</strong>,{" "}
              <strong>Cloudflare Workers</strong>,{" "}
              <strong>R2 Object Storage</strong>, and{" "}
              <strong>D1 SQL Databases</strong>.
            </p>
            <ul>
              <li>
                <strong>Relaybase:</strong> A one-time software license for the
                Mac client and management tools.
              </li>
              <li>
                <strong>Cloudflare:</strong> Billed separately and directly by
                Cloudflare to you (typically Cloudflare Workers Paid at ~
                ${siteConfig.cloudflareEmailSendingMonthly}/month, while R2
                includes 10 GB of free storage every month with zero egress fees).
                Relaybase is not a reseller of Cloudflare services.
              </li>
            </ul>
          </>
        ),
      },
      {
        id: "api-token-security",
        question:
          "What Cloudflare API Token permissions are needed, and why is it secure?",
        answer: (
          <>
            <p>
              <strong>
                Relaybase never receives, stores, or holds custody of your
                Cloudflare API Token.
              </strong>
            </p>
            <p>
              The API Token is stored strictly as an encrypted secret on{" "}
              <strong>your own Worker</strong> in your Cloudflare account (
              <code>CF_API_TOKEN</code> wrangler secret). When creating the token
              in your Cloudflare dashboard, it only needs the exact permissions
              required for your Worker to manage DNS and email routing rules:
            </p>
            <ul>
              <li>
                <code>Zone → Email Routing Rules → Edit</code> (Configure address
                routing)
              </li>
              <li>
                <code>Zone → Zone → Read</code> (List and inspect domain zones)
              </li>
              <li>
                <code>Zone → DNS → Edit</code> (Add required MX and SPF records)
              </li>
              <li>
                <code>Account → Workers R2 Storage → Edit</code> (R2 mailbox
                storage)
              </li>
            </ul>
            <p>
              Because the token lives entirely inside your Cloudflare
              infrastructure, Relaybase servers never have access to your
              credentials or account.
            </p>
          </>
        ),
      },
    ],
  },
  {
    title: "Features & Product Scope",
    items: [
      {
        id: "resend-sendgrid-comparison",
        question:
          "How is Relaybase different from transactional email services like Resend or SendGrid?",
        answer: (
          <>
            <p>
              Resend, SendGrid, and Postmark are excellent APIs focused primarily
              on <strong>outbound sending</strong>.
            </p>
            <p>
              Relaybase is a <strong>two-way product email infrastructure</strong>
              :
            </p>
            <ul>
              <li>
                <strong>Inbound &amp; Outbound:</strong> Receive customer replies
                at <code>support@</code> or <code>billing@</code>, view them in
                a native desktop inbox, and reply directly.
              </li>
              <li>
                <strong>Developer Primitives:</strong> Inbound HMAC-signed
                webhooks, pollable event APIs, and domain-scoped API keys (
                <code>rb_live_...</code>).
              </li>
              <li>
                <strong>No Per-Seat Pricing:</strong> Manage multiple product
                addresses across all your Cloudflare domains without paying
                per-mailbox SaaS fees.
              </li>
            </ul>
          </>
        ),
      },
      {
        id: "supported-platforms",
        question: "Which platforms are supported?",
        answer: (
          <ul>
            <li>
              <strong>macOS:</strong> Available now. Native desktop client built
              for Apple Silicon (macOS 12+) and Intel Macs.
            </li>
            <li>
              <strong>Mobile (iOS &amp; Android):</strong> On our roadmap
              (coming soon) — companion app for team triage of assigned product
              inboxes.
            </li>
            <li>
              <strong>Windows / Linux:</strong> Desktop support is on our
              roadmap.
            </li>
          </ul>
        ),
      },
    ],
  },
];
