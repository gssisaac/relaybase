import { ImageIcon, Video } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

type ShotList = {
  duration: string;
  frame: string;
  shots: string[];
  hide: string;
  file: string;
};

type WalkthroughFeature = {
  n: string;
  title: string;
  problem: string;
  solution: string;
  /** Drop the file at this public path to replace the placeholder. */
  src?: string;
  record: ShotList;
};

type PaidItem = {
  title: string;
  problem: string;
  solution: string;
  /** Drop the still at this public path to replace the placeholder. */
  src?: string;
  imageNote: string;
  file: string;
};

type PaidGroup = {
  id: string;
  title: string;
  lede: string;
  items: PaidItem[];
};

const walkthrough: WalkthroughFeature[] = [
  {
    n: "01",
    title: "Mail runs in your Cloudflare account",
    problem:
      "Hosted email services ask you to hand over nameservers or mail. That is a second vendor — and a trust problem if you already run on Cloudflare.",
    solution:
      "The routing Worker installs into your Cloudflare account. Relaybase is the app. We do not host your mail.",
    src: "/video/features/01-mail-in-your-account.mp4?v=1520x998",
    record: {
      duration: "14–18s",
      frame: "Mac app, full window, 16:9 crop. Hide the dock and desktop clutter.",
      shots: [
        "Open Setup → Install. Hold on the five resources: Worker relaybase-api, R2 relaybase-mailbox, D1 relaybase-db, relaybase-mail, relaybase-logs.",
        "Click Authorize (or flash Authorize and Manual so both paths are visible).",
        "End on Verify success with the Worker URL on screen.",
      ],
      hide: "Cloudflare API token, owner passtoken, account ID.",
      file: "/video/features/01-mail-in-your-account.mp4",
    },
  },
  {
    n: "02",
    title: "A locally cached inbox you can scan at full speed",
    problem:
      "Cloudflare Email Routing has no inbox. Product mail gets forwarded into a personal mailbox — and every row is another round-trip.",
    solution:
      "The Mac app keeps the inbox on disk. Arrow keys move the list instantly, so you can skim threads without waiting on the network.",
    src: "/video/features/02-mail-stack.mp4?v=1520x998-2",
    record: {
      duration: "6–10s",
      frame: "Mac inbox: list + detail. Arrow keys only.",
      shots: [
        "Start on Inbox with several demo threads visible.",
        "Hold ↑ / ↓ through the list so the detail pane keeps up.",
        "No mouse. The scan should feel instant.",
      ],
      hide: "Real customer names or inboxes — use demo addresses only.",
      file: "/video/features/02-mail-stack.mp4",
    },
  },
  {
    n: "03",
    title: "Keyboard-first triage inbox",
    problem:
      "The Cloudflare dashboard and a stack of browser tabs are not a client for reading and clearing mail quickly.",
    solution:
      "Stay on the keyboard. Arrows or j / k move the list; Enter opens; r reply, a reply all, f forward; c compose, ⇧C compose new; e / Backspace / Delete trash; Esc or u back to the list; ⌘K for any command.",
    src: "/video/features/03-keyboard-triage.mp4?v=1520x998",
    record: {
      duration: "14–18s",
      frame: "Inbox list + detail. Keep the pointer off-screen if you can.",
      shots: [
        "Press j / k through 3–4 rows so the selection clearly moves.",
        "Enter to open, Esc back to the list.",
        "r to start a reply, then Esc.",
        "⌘K — palette lists Reply, Trash, Compose. Optional: overlay the keys (j k Enter r ⌘K).",
      ],
      hide: "Mouse clicking. Do not dump dashboard navigation into the palette.",
      file: "/video/features/03-keyboard-triage.mp4",
    },
  },
  {
    n: "04",
    title: "Compose and drafts that never lose your work",
    problem:
      "A thin compose box is not a client. Close the tab, hit Esc, or refresh — and the reply is gone.",
    solution:
      "Autosave as you type. Esc closes without discarding. Reopen the same draft and keep writing — the compose UX of a real email client.",
    src: "/video/features/04-compose-drafts.mp4?v=1520x998",
    record: {
      duration: "12–16s",
      frame: "Compose or inline reply. Mac app, 3290/2160 crop.",
      shots: [
        "Start a reply and type a few sentences.",
        "Esc — composer closes, the draft remains.",
        "Reopen Drafts or press c — the same text is there.",
      ],
      hide: "Real customer mail.",
      file: "/video/features/04-compose-drafts.mp4",
    },
  },
  {
    n: "05",
    title: "A product address without a mailbox seat",
    problem:
      "A mailbox nobody lives in still often costs a full seat, so billing@ and support@ get treated like people.",
    solution:
      "Treat the address as domain infrastructure — one billing@ or support@ with no per-seat fee.",
    src: "/video/features/05-product-address.mp4?v=1520x998",
    record: {
      duration: "10–14s",
      frame: "Dashboard → Accounts, 16:9.",
      shots: [
        "Show billing@ and support@ in the Accounts list for one domain.",
        "Open support@ — display name and inbound on. It reads as an address, not a user.",
      ],
      hide: "Any seat-count or price UI.",
      file: "/video/features/05-product-address.mp4",
    },
  },
  {
    n: "06",
    title: "Per-account conversation threading (including Sent)",
    problem:
      "The same thread can duplicate, or a reply sent as another address leaks into the wrong conversation.",
    solution:
      "Dedupe on Message-ID, merge Sent only for the active account, and mark your own replies with (me).",
    src: "/video/features/06-threading.mp4?v=1520x998",
    record: {
      duration: "14–18s",
      frame: "Inbox list + open thread. Stay on one conversation.",
      shots: [
        "Start on All inboxes. Open a thread that already has a (me) reply.",
        "Switch the account filter to support@.",
        "Same thread: only support@ Sent is merged; (me) only for that address.",
      ],
      hide: "Jumping between unrelated threads.",
      file: "/video/features/06-threading.mp4",
    },
  },
  {
    n: "07",
    title: "Full-text mail search",
    problem:
      "You cannot find a body from the list alone, and a forwarded copy only shows what that other inbox indexed.",
    solution:
      "An inbound full-text index searches subject and body. Originals stay in your R2.",
    src: "/video/features/07-search.mp4?v=1520x998",
    record: {
      duration: "10–14s",
      frame: "Inbox search field + results + opened message.",
      shots: [
        "Type a phrase that exists only in a message body, not the subject.",
        "Results appear. Click one.",
        "The full message opens (loaded from R2).",
      ],
      hide: "An empty result set.",
      file: "/video/features/07-search.mp4",
    },
  },
  {
    n: "08",
    title: "Console mode for the stack on your account",
    problem:
      "Worker, D1, and R2 live in your Cloudflare account — but checking whether they are actually connected usually means leaving the app.",
    solution:
      "Console mode is the Dashboard. See and control Worker, D1, and R2 connection status from one place, because the mailbox runs on your account — not ours.",
    src: "/video/features/08-console-mode.mp4?v=1520x998",
    record: {
      duration: "8–12s",
      frame: "Dashboard / console. Worker, D1, and R2 status in frame.",
      shots: [
        "Open Dashboard (console mode).",
        "Hold on Worker, D1, and R2 connection status.",
        "Show a connect / reconnect or health control if it is in the take.",
      ],
      hide: "Owner passtoken, account ID, Cloudflare API token.",
      file: "/video/features/08-console-mode.mp4",
    },
  },
  {
    n: "09",
    title: "One-pass install into your Cloudflare account",
    problem:
      "Standing up an email client usually means provisioning a Worker, a database, and object storage by hand — or handing the mailbox to a host.",
    solution:
      "Download the desktop app and authorize Cloudflare. The server and databases — Worker, D1, R2 — install into your account in one pass, ready to run mail.",
    src: "/video/features/09-one-pass-install.mp4?v=1520x998",
    record: {
      duration: "10–14s",
      frame: "Mac app Setup → Install. Authorize, then the resource list.",
      shots: [
        "Start on the desktop app download or Setup → Install.",
        "Click Authorize and return from Cloudflare.",
        "End on Worker, D1, and R2 in the account — one pass.",
      ],
      hide: "Cloudflare API token, owner passtoken, account ID.",
      file: "/video/features/09-one-pass-install.mp4",
    },
  },
  {
    n: "10",
    title: "Domain-scoped API keys",
    problem:
      "A Cloudflare token copied into an app .env can send as any domain on the account if it leaks.",
    solution:
      "One key per domain. A from that does not match that domain is rejected.",
    src: "/video/features/10-domain-keys.mp4?v=1520x998",
    record: {
      duration: "12–16s",
      frame: "Dashboard → API Keys. 16:9.",
      shots: [
        "Open Issue API key.",
        "Pick one domain. Issue the key.",
        "The new row is bound to that domain. Copy once, then hide the secret.",
      ],
      hide: "Holding the full key on screen.",
      file: "/video/features/10-domain-keys.mp4",
    },
  },
];

const paidGroups: PaidGroup[] = [
  {
    id: "paid-domains",
    title: "Every domain on the account",
    lede: "One Worker and one Mac app for every mailbox you already run on Cloudflare. Import the next zone from the account you already have.",
    items: [
      {
        title: "Unified multi-domain inbox",
        problem:
          "Cloudflare Email Routing only forwards. Mail for each domain ends up scattered across tabs and accounts.",
        solution:
          "One Worker and one Mac app show every mailbox on the account, side by side.",
        src: "/images/features/paid-multi-domain.png",
        imageNote:
          "Mac inbox with two or more domains visible — list + account filter, not a single mailbox.",
        file: "/images/features/paid-multi-domain.png",
      },
      {
        title: "Import Cloudflare zones + DNS / routing onboarding",
        problem:
          "Each new domain means repeating Email Sending onboarding, DKIM, MX, and routing rules in the Cloudflare dashboard.",
        solution:
          "Import zones from the account. The app continues through DNS wait, provisioning, and address routing.",
        src: "/images/features/paid-import-zones.png",
        imageNote:
          "Domains → Import Cloudflare zones. Dialog open with two zones checked, before Import.",
        file: "/images/features/paid-import-zones.png",
      },
    ],
  },
  {
    id: "paid-addresses",
    title: "Every address in one list",
    lede: "See all inboxes or filter by address. Add a domain and the six product addresses are already there.",
    items: [
      {
        title: "All inboxes + per-account switcher",
        problem:
          "Switching between you@ and support@ means another login, or a personal inbox where the real recipient is unclear.",
        solution:
          "See everything in one list or filter by address, with unread counts per account.",
        src: "/images/features/paid-account-switcher.png",
        imageNote:
          "Inbox account switcher — All inboxes selected, unread counts on you@ and support@.",
        file: "/images/features/paid-account-switcher.png",
      },
      {
        title: "Standard product addresses in one step",
        problem:
          "Every new product means recreating billing@ through admin@, display names, and inbound on/off by hand.",
        solution:
          "Adding a domain seeds the six defaults. noreply@ is send-only; the rest receive immediately.",
        src: "/images/features/paid-default-addresses.png",
        imageNote:
          "Accounts list: billing@ Inbound off, menu open on the inbound toggle.",
        file: "/images/features/paid-default-addresses.png",
      },
    ],
  },
  {
    id: "paid-team-broadcasts",
    title: "Teammates and audience",
    lede: "Hand someone only that mailbox. Keep subscriber lists on the same dashboard.",
    items: [
      {
        title: "Teammate mobile / email-only access",
        problem:
          "Handing someone support@ usually means a Cloudflare token, a full mailbox seat, or a forward that widens access.",
        solution:
          "Accounts → Other device issues a per-address password. The teammate sees only that mailbox on phone or desktop.",
        src: "/images/features/paid-other-device.png",
        imageNote:
          "Accounts → support@ → Other device. Password issued, QR in frame. No owner passtoken.",
        file: "/images/features/paid-other-device.png",
      },
      {
        title: "Audience",
        problem:
          "Subscriber lists often leave the domain, or live in a tool that is not the inbox.",
        solution:
          "Audience groups (manual or synced) stay on the domain.",
        src: "/images/features/paid-audience.png",
        imageNote:
          "Audience groups list on the domain — one group, contact count, data source.",
        file: "/images/features/paid-audience.png",
      },
    ],
  },
];

/** Feature clips encode at 1520×998 (760 CSS ×2, 3290/2160). H.264 High, CRF 18, 60fps. */
function FeatureClip({ feature }: { feature: WalkthroughFeature }) {
  const { record, src, title } = feature;

  if (src) {
    return (
      <div className="overflow-hidden rounded-lg border border-border bg-black shadow-sm">
        <video
          className="aspect-[3290/2160] h-auto w-full object-cover object-top"
          width={760}
          height={499}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-label={title}
        >
          <source src={src} type="video/mp4" />
        </video>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950 text-left shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-4 py-2.5">
        <div className="flex items-center gap-2 text-xs font-medium text-slate-300">
          <Video className="size-3.5 text-brand" aria-hidden />
          Screen recording
        </div>
        <p className="font-mono text-[11px] text-slate-500">
          {record.duration} · muted · autoplay
        </p>
      </div>
      <div className="min-h-[16rem] p-4 sm:p-5 md:min-h-[20rem]">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          How to record this clip
        </p>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-300">
          {record.frame}
        </p>
        <ol className="mt-3 list-decimal space-y-1.5 pl-4 text-sm leading-relaxed text-slate-400">
          {record.shots.map((shot) => (
            <li key={shot}>{shot}</li>
          ))}
        </ol>
        <p className="mt-3 text-xs leading-relaxed text-slate-500">
          Hide: {record.hide}
        </p>
        <p className="mt-2 font-mono text-[11px] text-slate-600">
          Drop file at {record.file}
        </p>
      </div>
    </div>
  );
}

function PaidStill({ item }: { item: PaidItem }) {
  if (item.src) {
    return (
      <img
        src={item.src}
        alt=""
        className="aspect-[3290/2160] w-full object-cover object-top"
      />
    );
  }

  return (
    <div className="flex aspect-[16/10] flex-col justify-between border-b border-border bg-slate-950 p-4 text-left">
      <div className="flex items-center gap-2 text-xs font-medium text-slate-300">
        <ImageIcon className="size-3.5 text-brand" aria-hidden />
        Still
      </div>
      <div>
        <p className="text-sm leading-relaxed text-slate-400">{item.imageNote}</p>
        <p className="mt-2 font-mono text-[11px] text-slate-600">{item.file}</p>
      </div>
    </div>
  );
}

function FeatureCopy({ feature }: { feature: WalkthroughFeature }) {
  return (
    <div>
      <Badge variant="outline" className="mb-4">
        {feature.n}
      </Badge>
      <h3
        id={`feature-${feature.n}`}
        className="text-2xl font-bold tracking-tight md:text-3xl"
      >
        {feature.title}
      </h3>
      <p className="mt-4 text-muted-foreground">{feature.problem}</p>
      <p className="mt-3 text-foreground">{feature.solution}</p>
    </div>
  );
}

export function FeatureWalkthrough() {
  return (
    <div id="features">
      <section className="border-b border-border py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <Badge variant="outline" className="mb-4">
              Features
            </Badge>
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
              Inbox first. API when you need it.
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Ten short clips — each 10–20 seconds, muted, looping — so you can
              see the Mac app and your Worker without a walkthrough video.
            </p>
          </div>
        </div>
      </section>

      {walkthrough.map((feature, index) => (
        <section
          key={feature.n}
          aria-labelledby={`feature-${feature.n}`}
          className={cn(
            "overflow-x-clip border-b border-border py-16 md:py-[140px]",
            index % 2 === 1 ? "bg-well" : "bg-background",
          )}
        >
          <div
            className={cn(
              "mx-auto grid max-w-6xl items-center gap-10 px-6 lg:gap-14",
              index % 2 === 1
                ? "lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]"
                : "lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]",
            )}
          >
            <div className={index % 2 === 1 ? "lg:order-2" : undefined}>
              <FeatureCopy feature={feature} />
            </div>
            <div
              className={cn(
                index % 2 === 1 ? "lg:order-1" : undefined,
                "min-w-0 lg:w-[115%]",
                index % 2 === 1 && "lg:-ml-[15%]",
              )}
            >
              <FeatureClip feature={feature} />
            </div>
          </div>
        </section>
      ))}

      <section
        id="paid"
        className="border-b border-border bg-slate-950 py-16 text-white md:py-20"
      >
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <Badge
              variant="outline"
              className="mb-4 border-slate-700 bg-slate-900 text-slate-300"
            >
              Paid
            </Badge>
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
              When one domain is not enough
            </h2>
            <p className="mt-4 text-lg text-slate-400">
              Unlocked for everyone in the beta.
            </p>
          </div>
        </div>
      </section>

      {paidGroups.map((group, index) => (
        <section
          key={group.id}
          aria-labelledby={group.id}
          className={cn(
            "border-b border-border py-16 md:py-20",
            index % 2 === 0 ? "bg-well" : "bg-background",
          )}
        >
          <div className="mx-auto max-w-6xl px-6">
            <div className="max-w-2xl">
              <h2
                id={group.id}
                className="text-3xl font-bold tracking-tight md:text-4xl"
              >
                {group.title}
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">{group.lede}</p>
            </div>

            <div className="mt-12 grid gap-4 sm:grid-cols-2">
              {group.items.map((item) => (
                <Card key={item.title} className="bg-white pt-0">
                  <PaidStill item={item} />
                  <CardHeader>
                    <CardTitle>{item.title}</CardTitle>
                    <CardDescription>{item.problem}</CardDescription>
                    <p className="mt-2 text-sm leading-relaxed text-foreground">
                      {item.solution}
                    </p>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}
