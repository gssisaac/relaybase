import {
  CreditCard,
  Headphones,
  Lock,
  MailX,
  Shield,
  Sparkles,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { siteConfig } from "@/lib/site-config";

const iconMap = {
  billing: CreditCard,
  support: Headphones,
  privacy: Lock,
  "no-reply": MailX,
  hello: Sparkles,
  admin: Shield,
} as const;

export function EmailAddresses() {
  return (
    <section id="addresses" className="border-b border-border bg-well py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <Badge variant="outline" className="mb-4 bg-white">
            Standard addresses
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            The emails every product needs — ready on day one
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Stop provisioning a Google Workspace seat for every role. Relaybase
            gives you all the standard addresses your users expect, routed and
            API-ready from a single domain.
          </p>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {siteConfig.standardAddresses.map((addr) => {
            const Icon = iconMap[addr.role as keyof typeof iconMap] ?? MailX;
            return (
              <Card key={addr.role} className="bg-white">
                <CardHeader>
                  <div className="mb-2 flex size-9 items-center justify-center rounded-lg bg-secondary">
                    <Icon className="size-4 text-brand" />
                  </div>
                  <CardTitle className="font-mono text-sm">
                    {addr.address}
                  </CardTitle>
                  <CardDescription>{addr.purpose}</CardDescription>
                </CardHeader>
                <CardContent>
                  <span className="inline-flex rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
                    {addr.role}
                  </span>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <p className="mx-auto mt-10 max-w-xl text-center text-sm text-muted-foreground">
          Add more aliases anytime — no extra seats, no per-mailbox fees. Perfect
          when you ship multiple products and need{" "}
          <span className="font-medium text-foreground">
            billing@product-a.com
          </span>{" "}
          and{" "}
          <span className="font-medium text-foreground">
            support@product-b.com
          </span>{" "}
          without doubling your email bill.
        </p>
      </div>
    </section>
  );
}
