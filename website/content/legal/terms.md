---
title: "Terms & Conditions"
description: "The terms governing use of the Relaybase website, API, and operator/customer dashboards."
date: "2026-08-06"
---

Please read these Terms and Conditions ("Terms") carefully before using the Relaybase website at relaybase.xyz, the Relaybase API, and the operator and customer dashboards (together, the "Service") operated by Strum Technology Corp, a Delaware corporation doing business as Relaybase ("us", "we", or "our").

## 1. Acceptance of Terms

By accessing or using the Service, you agree to be bound by these Terms. If you disagree with any part of the Terms, you may not access the Service. If you are using the Service on behalf of an organization, you represent that you have authority to bind that organization, and "you" refers to that organization.

## 2. Description of Service

Relaybase provides product email infrastructure on a per-domain basis, including:

- Transactional email send from any address on a verified domain (`POST /v1/send`)
- Inbound email receive via poll (`/v1/inbox/events`, `/v1/inbox/messages/:id`) or signed webhook
- Provisioning of standard addresses (`billing@`, `support@`, `privacy@`, `noreply@`, `hello@`, `admin@`) on domains verified through Cloudflare Email Sending and Email Routing
- Domain-scoped API keys, one per sending domain
- An operator dashboard (keys, send logs, inbound mail, user accounts) and a customer dashboard (inbox, compose, sender accounts, audience, broadcasts, domain setup, API keys, metrics)
- Website, waitlist, and related online services

Details of how data is processed are described in our Privacy Policy.

## 3. Eligibility and accounts

You must be able to form a binding contract to use the Service. The Service is not intended for children under 13.

Access to send and receive email through the API requires an account and a domain-scoped API key issued by us. During the waitlist phase, accounts and domains may be provisioned manually as we onboard new Customers; self-service registration may be limited or closed at our discretion. You are responsible for keeping your account credentials and API keys secure and for all activity that occurs under them.

## 4. Domain verification and Cloudflare setup

To use the Service on a domain, that domain (or the relevant DNS records) must be configured to work with Cloudflare Email Sending and Email Routing under our managed Cloudflare account. You represent that you own or are authorized to configure the domain you submit for verification, and you authorize us to configure the DNS, sending, and routing records necessary to operate the Service on that domain.

We may decline to provision, or may suspend, a domain if verification fails, if the domain is used for abuse, or if required by Cloudflare's own policies.

## 5. Acceptable use

You agree not to:

- Use the Service to send unsolicited bulk email ("spam"), or in violation of the CAN-SPAM Act, CASL, GDPR e-privacy rules, or similar anti-spam or electronic-communications laws in any applicable jurisdiction
- Use the Service in violation of any law or others' rights
- Attempt unauthorized access to our systems, another Customer's domain, keys, or data
- Send content that is fraudulent, deceptive (including phishing or spoofing), defamatory, or that infringes intellectual property or privacy rights
- Distribute malware or use inbound receive to abuse third-party systems
- Exceed reasonable use of your API key in a way that degrades the Service for others, or attempt to circumvent domain-scoped key isolation
- Reverse engineer the Service except as allowed by law
- Resell the Service without our prior written consent

We may suspend or terminate a domain-scoped API key without prior notice if we reasonably believe it is being used to violate this section, generates abuse or spam complaints, or produces bounce or complaint rates that put our sending infrastructure's deliverability at risk for other Customers.

## 6. Your content and message data

You retain ownership of the message content you send and receive through the Service (including email bodies, attachments, and metadata).

You grant us a limited license to transmit, store, parse, and deliver that content solely to provide the Service — for example, relaying an outbound send, storing an inbound message so you can fetch it later, or delivering a webhook event.

You are solely responsible for:

- Obtaining any consents required to email the recipients you contact through the Service
- The accuracy and legality of content you send
- Complying with data-protection and consumer-protection obligations that apply to your use of the Service, including if you are processing personal data of your own end users through addresses on your domain

## 7. API keys and webhooks

Each API key is scoped to a single verified domain; the `from` address on every send must match that domain. You are responsible for safeguarding your API keys and webhook signing secrets. Notify us promptly if you believe a key or secret has been compromised so we can rotate or revoke it.

If you register a webhook endpoint, you are responsible for verifying the HMAC signature on incoming events before trusting the payload, and for the security of that endpoint.

## 8. Fees and payment

Current and future pricing (including flat per-domain pricing and any waitlist discount rates) is described on our website and may be updated from time to time.

- Fees are based on the domain(s) and plan you have active
- Payments, once billing is live, will be processed by a third-party payment processor
- Fees are generally non-refundable except where required by law
- We may change prices with notice; continued use after the change's effective date constitutes acceptance where permitted by law
- Waitlist or promotional pricing may be time-limited and may change or end as described at signup

## 9. Third-party services

The Service depends on Cloudflare (Email Sending, Email Routing, Workers, KV, R2, D1) and may depend on analytics or payment processors. Their terms and privacy policies apply to their processing. We are not responsible for third-party services we do not control, including outages or policy changes at Cloudflare that affect deliverability or routing.

## 10. Service availability

We aim to keep the Service reliably available but do not guarantee uninterrupted or error-free operation. Email delivery depends on factors outside our control, including recipient mail servers, spam filtering, and upstream infrastructure providers. We are not responsible for delayed, filtered, or undelivered mail caused by factors outside our reasonable control.

## 11. Termination

You may stop using the Service, delete your webhook registrations, and request deletion of stored inbound messages at any time. We may suspend or terminate access if you violate these Terms, abuse the Service, fail to pay applicable fees, or if we discontinue the Service, with notice where practicable. Upon termination, provisions that by nature should survive (including intellectual property, disclaimers, and limitation of liability) will survive.

## 12. Disclaimers

THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED OR ERROR-FREE, OR THAT ANY PARTICULAR EMAIL WILL BE DELIVERED, RECEIVED, OR ACCEPTED BY ANY RECIPIENT OR MAIL PROVIDER.

## 13. Limitation of liability

TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE ARE NOT LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR FOR LOST PROFITS, DATA, OR GOODWILL, INCLUDING DAMAGES ARISING FROM UNDELIVERED OR MISDIRECTED EMAIL. OUR AGGREGATE LIABILITY ARISING OUT OF THE SERVICE IS LIMITED TO THE GREATER OF (A) THE AMOUNTS YOU PAID US FOR THE SERVICE IN THE TWELVE (12) MONTHS BEFORE THE CLAIM OR (B) ONE HUNDRED U.S. DOLLARS (US $100) IF YOU HAVE NOT PAID US.

Some jurisdictions do not allow certain limitations; in those cases our liability is limited to the fullest extent permitted.

## 14. Indemnity

You will defend and indemnify us against claims arising from your misuse of the Service, the content you send or receive through it, your violation of §5 (Acceptable use), or your violation of these Terms or applicable law, except to the extent caused by our willful misconduct.

## 15. Privacy

Our Privacy Policy explains how we collect and use information, including message content processed on behalf of Customers. It is incorporated by reference into these Terms.

## 16. Changes to Terms

We may modify these Terms by posting an updated version on this page. Material changes may be communicated by email or in-product notice when appropriate. Continued use after changes become effective constitutes acceptance where permitted by law.

## 17. Governing law

These Terms are governed by the laws of the State of Delaware, United States, without regard to conflict-of-law rules. Courts in Delaware (or, if required, the federal courts sitting there) shall have exclusive jurisdiction, except where applicable consumer law requires otherwise.

## 18. Contact us

- Email: support@relaybase.xyz
- Website: https://relaybase.xyz
- Company: Strum Technology Corp
- Address: 1875 Mission St Ste 103 #783, San Francisco, CA 94103

## 19. Acknowledgment

By using Relaybase, you acknowledge that you have read these Terms and agree to be bound by them.
