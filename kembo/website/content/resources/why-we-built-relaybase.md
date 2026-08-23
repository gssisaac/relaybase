---
title: "Why We Built Relaybase: A Vercel Outage, a Cloudflare Migration, and $5 a Month"
navTitle: "Why we built Relaybase"
description: "Relaybase didn't start as a product idea. It started with a CDN going down during a live ticketing launch, a scramble onto Cloudflare, and a $5/month email setup we kept reusing."
keyword: "Relaybase origin story"
order: 11
date: "2026-08-13"
image: "/images/resources/why-we-built-relaybase-hero.webp"
imageAlt: "A flat vector illustration showing a broken browser with a traffic spike on the left, a teal migration arrow in the middle, and a stable Cloudflare edge cloud with email envelopes and a single price tag on the right"
---

Relaybase wasn't the plan. It's what was left over after we fixed a much more urgent problem.

## The launch that broke Vercel

Last July, a well-known client asked us to build a ticketing service. The backend ran on Railway. The frontend shipped as a static Next.js export behind a CDN, so ticketing traffic would never touch the backend directly — Vercel was the obvious, boring choice for that piece.

It wasn't boring. Ticket sales opened, the request graph went vertical, and about five minutes in, Vercel went down. Not the backend — Railway never blinked. The CDN. A CDN going down for a fully static export doesn't make sense on paper, but it happened: even a static Next.js export routes through Vercel's Edge Function layer, and at roughly 3 million requests in the first hour, heavily front-loaded in the first few minutes, that layer couldn't absorb the burst. We spent that afternoon into the early morning migrating the frontend to Cloudflare. The second ticketing drop, the next day, had zero problems. Vercel billed us about $200 for the hour of Edge Function calls we never intended to trigger on a page that was supposed to be static.

That single night is the reason everything below exists.

## What that migration turned into

We didn't stop at one project. Over the following year we moved a growing share of our infrastructure onto Cloudflare — Workers running services as static sites or lightweight backends, D1 for SQLite without a database server to babysit, R2 replacing S3 for file storage. Workers deploy to Cloudflare's global edge by default, so the same setup that survived a ticketing spike was also just faster everywhere, by construction.

Then Cloudflare opened **Email Sending** in beta, and the same instinct kicked in: try it on real infrastructure, not a toy example.

## The $5/month email setup that didn't scale as a habit

We stood up `support@`, `privacy@`, and the rest of the standard set across more than ten domains — every product we were running or building for clients. Roughly 70 accounts, all on one Cloudflare bill that never went past $5 a month, because Email Sending pricing doesn't care how many addresses you provision on a verified domain.

That part worked. What didn't scale was doing it by hand every time. Each new domain meant repeating the same DNS verification, the same DKIM setup, the same manual API wiring — and once you're not the only one who needs to check `support@` or issue a key, a Cloudflare dashboard and a spreadsheet of who has access to what stops being a real answer.

We'd built the same thing enough times that it was obviously a product, not a habit.

## Why Relaybase isn't a hosted relay

The first instinct for turning "we keep doing this" into a product is usually a hosted multi-tenant service — sign up, verify your domain with us, we run the mail server. We built a version of that and didn't ship it as the final shape, because it recreates the exact trust problem we were trying to avoid: someone else's account sitting between you and your own domain's mail.

Relaybase installs a Worker into **your** Cloudflare account instead. Your domain, your Email Sending and Email Routing, your data — Relaybase is the Mac app and the API layer on top, not a mail server we operate on your behalf. The $5/month Cloudflare bill is yours and billed by Cloudflare directly; Relaybase is a one-time license for the app that makes that setup usable across every domain you run, instead of a fresh round of console archaeology each time.

That's the shape we actually wanted back on the night we were migrating a client's frontend at 2am — infrastructure we could see and control directly, not a new intermediary to debug when something breaks during the next launch.

## The takeaway

Relaybase exists because we needed it first. A CDN outage taught us to stop assuming a platform would absorb traffic just because the page was "static." Standing up email across ten-plus domains for $5 a month taught us that Cloudflare's primitives are cheap enough to build real infrastructure on — the missing piece was never the platform, it was a tool that made using it repeatable.

If you're already running domains on Cloudflare and provisioning `billing@` or `support@` one console session at a time, see what that setup actually costs versus [Google Workspace's seat pricing](/resources/google-workspace-vs-product-email), or how the underlying [Email Routing and Sending primitives](/resources/cloudflare-email-routing-for-developers) work before you decide to build the wrapper yourself. Otherwise, [join the Relaybase beta](/get-started) and skip straight to the part where it's already built.
