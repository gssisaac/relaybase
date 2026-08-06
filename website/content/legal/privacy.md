---
title: "Privacy Policy"
description: "How Relaybase collects, uses, and protects information across the website, waitlist, API, and operator/customer dashboards."
date: "2026-08-06"
---

This Privacy Policy describes how Strum Technology Corp, a Delaware corporation doing business as Relaybase ("we", "us", or "our"), collects, uses, and shares information when you use the Relaybase website at relaybase.xyz, the Relaybase API, and the operator and customer dashboards (together, the "Service").

Relaybase is product email infrastructure: we help a Customer send and receive email on addresses at the Customer's own domain (`billing@yourdomain.com`, `support@yourdomain.com`, and similar). Because of that, this policy covers two different kinds of information: information about **you** if you visit the website, join the waitlist, or hold an account with us (where we act as a controller), and **message content** that flows through the API on behalf of a Customer (where we act as a processor, handling that content only to provide the Service).

## 1. Roles: controller and processor

| Role | When it applies | What it covers |
| --- | --- | --- |
| Controller | Website visits, waitlist signups, account/API-key holders, support requests | Your contact details, account activity, analytics |
| Processor | Email sent or received through a Customer's domain via the API | Message content (sender, recipient, subject, body, attachments), inbound/outbound event metadata |

If you are the person emailing `support@` or `billing@` on a domain that runs on Relaybase, we process your message on behalf of that domain's owner (our Customer), not on our own behalf. Questions about that specific correspondence should go to the domain owner; this policy explains how we, as their infrastructure provider, handle that data technically.

## 2. Information we collect directly

### 2.1 Waitlist and account information

When you join the waitlist or hold a Relaybase account, we collect:

- Email address
- An optional source tag (which page or campaign you signed up from)
- Your browser's user agent string, captured at signup
- For account holders: your account identifier and any domains, API keys, and webhook endpoints you configure

We use this to contact you about early access, product updates, and to operate your account.

### 2.2 Support and correspondence

If you email us or use an in-product contact form, we process the contents of that message and any information you choose to include in order to respond.

### 2.3 Website analytics

The website may load Google Analytics 4 when configured (`NEXT_PUBLIC_GA_MEASUREMENT_ID`). GA may set cookies and collect usage data (pages viewed, approximate location derived by Google, device/browser information, and custom events such as waitlist signup) under Google's terms. We do not currently show a separate cookie-consent banner; you can block or clear cookies in your browser settings.

## 3. Message content processed through the API (as processor)

When a Customer uses the Relaybase API on a verified domain, the following content passes through our infrastructure to provide the send/receive Service:

### 3.1 Outbound (transactional send)

Calling `POST /v1/send` transmits the `from`, `fromName`, `to`, `cc`, `subject`, `text`/`html` body, and any reply-threading headers supplied by the Customer's integration. We relay this to Cloudflare Email Sending for delivery and record a send log entry (see §5) so the Customer can see what was sent.

### 3.2 Inbound (receive)

Mail sent to a routed address on a Customer's domain (for example, a reply to a receipt, or a new message to `support@`) is delivered through Cloudflare Email Routing to our infrastructure, where we parse and store the sender, recipient(s), subject, body (text and HTML), and attachments so the Customer can fetch it via `/v1/inbox/messages/:id` or receive it through a webhook.

### 3.3 Webhook events

If a Customer registers a webhook, we deliver an HMAC-signed event (`inbound.email.received`) containing sender, subject, a short preview, and attachment flags to the Customer's endpoint when mail arrives. The signing secret is stored as a one-way hash on our servers; we cannot recover it after issuance.

We do not read, use, or analyze message content for any purpose other than delivering, storing, and making it retrievable through the API on the Customer's behalf. We do not use message content to train models, and we do not sell it.

## 4. Domain and infrastructure setup

To provision a domain, a Customer's DNS is configured so that Cloudflare Email Sending and Email Routing operate on our managed Cloudflare account. We hold the Cloudflare account credentials needed to configure sending domains, routing rules, and DNS records for provisioned domains; Customers do not need to hold or share their own Cloudflare API tokens with us to use the Service.

## 5. Logs and operational data

- **Send logs**: For each send attempt, we record success/failure status, the domain, a masked API key prefix (not the full key), `from`, `to`, `subject`, a provider message ID, and any error message. Logs are retained on a rolling basis — the most recent 500 entries per environment; older entries are automatically deleted as new ones are recorded.
- **Inbound message store**: Inbound messages (metadata and body) are retained on a rolling basis per domain — the most recent 500 messages; older messages and their attachments are automatically deleted as new ones arrive. A Customer can also delete stored messages sooner via the dashboard or API.
- **API keys**: We store a hash of each API key, not the plaintext value, along with the domain it is scoped to, a label, and a truncated prefix for identification in logs.

## 6. How we use information

We use information to:

- Provide and operate the Service, including sending, receiving, storing, and delivering email content as instructed by our Customers
- Verify domains and provision Cloudflare Email Sending / Email Routing
- Communicate with waitlist members and account holders about updates and support
- Monitor for delivery failures, abuse, and security issues
- Improve reliability and understand aggregate website usage
- Comply with law and enforce our Terms

## 7. Information sharing

We may share information with:

- **Cloudflare**, which provides the underlying email sending, email routing, Workers, KV, R2, and D1 infrastructure that the Service runs on
- **Analytics providers** (Google Analytics) for the website, when enabled
- **Professional advisors or authorities** when required by law or to protect rights and safety
- A **successor entity** in connection with a merger, acquisition, or sale of assets, subject to this policy or a materially similar one

We do not sell your personal information, and we do not sell or share message content processed on behalf of Customers.

## 8. Data retention

| Data | Retention |
| --- | --- |
| Waitlist entries | Until you ask us to delete them, or we no longer need them for the waitlist purpose |
| Account and domain configuration (API keys, webhook URLs) | Until the account or domain is removed |
| Send logs | Rolling window of the most recent 500 entries per environment |
| Inbound messages and attachments | Rolling window of the most recent 500 per domain, or until deleted by the Customer |
| Support correspondence | As needed to resolve the request and for our records |
| Website analytics | Per Google Analytics retention settings |

## 9. Your choices and rights

You can:

- Ask us to delete a waitlist entry by emailing us
- Delete stored inbound messages via the dashboard or API (if you are a domain owner/Customer)
- Rotate or revoke an API key at any time from the dashboard
- Opt out of marketing emails we send
- Request access, correction, or deletion of personal data we hold about you by emailing privacy@relaybase.xyz

Depending on your location (including California and the EEA/UK), you may have additional rights such as access, deletion, portability, restriction, objection, and withdrawal of consent. We will not discriminate against you for exercising privacy rights.

## 10. International transfers

We and our processors (including Cloudflare) may process information in the United States and other countries. Where required, we use appropriate safeguards for cross-border transfers.

## 11. Children's privacy

The Service is not directed to children under 13. We do not knowingly collect personal information from children under 13. If you believe a child has provided us information, contact us and we will take appropriate steps to delete it.

## 12. Security

We use HTTPS in transit, hashed API keys and webhook secrets, domain-scoped key isolation, and access controls on our infrastructure. No method of transmission or storage is perfectly secure, and we cannot guarantee absolute security.

## 13. Changes to this policy

We may update this Privacy Policy by posting a new version on this page and updating the "Last updated" date. Material changes may be communicated by email or in-product notice when appropriate. Continued use of the Service after an update constitutes acceptance of the revised policy where permitted by law.

## 14. Contact us

- Email: privacy@relaybase.xyz
- Website: https://relaybase.xyz
- Company: Strum Technology Corp
- Address: 1875 Mission St Ste 103 #783, San Francisco, CA 94103

## 15. California privacy rights (CCPA/CPRA)

If you are a California resident, you may have the right to know what personal information we collect, request deletion, correct inaccurate information, and opt out of "sale" or "sharing" of personal information as those terms are defined by California law. We do not sell personal information. To exercise rights, contact privacy@relaybase.xyz. You may designate an authorized agent as permitted by law.

## 16. GDPR / UK GDPR (EEA and UK)

If we process your personal data subject to GDPR/UK GDPR, our legal bases may include contract (providing the Service you or your organization requested), legitimate interests (securing and improving the Service, understanding site usage), consent (where required, for example certain cookies or marketing), and legal obligation. Where we process message content on behalf of a Customer, the Customer is generally the controller and we act as their processor. You may have rights of access, rectification, erasure, restriction, portability, objection, and complaint to a supervisory authority. Contact privacy@relaybase.xyz.
