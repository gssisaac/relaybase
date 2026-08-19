import { Boxes, Layers, MoveRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentProPrice } from "@/lib/site-config";

const personas = [
  {
    icon: Layers,
    title: "Multi-domain Cloudflare operators",
    description:
      "You've got five, ten, or twenty domains on Cloudflare with Email Routing quietly forwarding somewhere. Relaybase gives every one of them a real inbox — one Worker, one Mac app.",
    example: `A builder with a dozen Cloudflare zones — one $${getCurrentProPrice()} license, every mailbox side by side in one app.`,
  },
  {
    icon: MoveRight,
    title: "Already on Cloudflare, mail somewhere else",
    description:
      "Your domains, DNS, and Workers are already on Cloudflare — your inbox is still tied to a different provider. Move it over without a nameserver migration or a new vendor contract.",
    example:
      "A team already running Workers and R2 in production, finally bringing support@ onto the same account.",
  },
  {
    icon: Boxes,
    title: "Solo builders running multiple products",
    description:
      "Every product gets its own domain, its own billing@ and support@, and the same fast inbox pattern — switch between them without logging into five different tools.",
    example:
      "An indie founder shipping four products on four zones — same Mac app, same Worker pattern, for all of them.",
  },
];

export function UseCases() {
  return (
    <section className="border-b border-border bg-well py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <Badge variant="outline" className="mb-4 bg-white">
            Who it&apos;s for
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            Email UX for people who already run Cloudflare
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            If you manage multiple domains on Cloudflare, Relaybase is the
            inbox and Worker wrapper you&apos;ve been missing — not a hosted
            mailbox, not a new vendor.
          </p>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {personas.map((persona) => (
            <Card key={persona.title} className="bg-white">
              <CardHeader>
                <div className="mb-2 flex size-9 items-center justify-center rounded-lg bg-secondary">
                  <persona.icon className="size-4 text-brand" />
                </div>
                <CardTitle>{persona.title}</CardTitle>
                <CardDescription>{persona.description}</CardDescription>
                <p className="mt-3 rounded-lg bg-well p-3 text-xs leading-relaxed text-muted-foreground">
                  {persona.example}
                </p>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
