import {
  Globe,
  Inbox,
  Key,
  Layers,
  MonitorSmartphone,
  Send,
  Webhook,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const features = [
  {
    icon: MonitorSmartphone,
    title: "Mac app inbox",
    description:
      "A fast, keyboard-driven inbox for every address across every domain on your Cloudflare account.",
  },
  {
    icon: Send,
    title: "Transactional send",
    description:
      "Fire billing receipts, password resets, and onboarding emails from any address on your domain.",
  },
  {
    icon: Inbox,
    title: "Inbound receive",
    description:
      "support@ and privacy@ land in your Worker. Poll events or push via webhooks — your choice.",
  },
  {
    icon: Webhook,
    title: "Signed webhooks",
    description:
      "Stripe-style HMAC verification. Plug into n8n, Zapier, or your own handler in one POST.",
  },
  {
    icon: Key,
    title: "Domain-scoped keys",
    description:
      "One API key per domain, issued by the Worker in your account — no credential sprawl.",
  },
  {
    icon: Layers,
    title: "Multi-domain ready",
    description:
      "Pull every zone from your Cloudflare account. Same UI pattern across products.",
  },
  {
    icon: Globe,
    title: "Your domains",
    description:
      "Customers see billing@yourbrand.com. Nameservers stay on your Cloudflare zones — never ours.",
  },
];

export function Features() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <Badge variant="outline" className="mb-4">
            Features
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            Everything a product team needs — nothing you don&apos;t
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            A desktop client and Worker wrapper around Cloudflare Email — not
            another hosted inbox we operate for you.
          </p>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <Card
              key={feature.title}
              className="bg-white transition-shadow hover:shadow-md"
            >
              <CardHeader>
                <div className="mb-2 flex size-9 items-center justify-center rounded-lg bg-brand/10">
                  <feature.icon className="size-4 text-brand" />
                </div>
                <CardTitle>{feature.title}</CardTitle>
                <CardDescription>{feature.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
