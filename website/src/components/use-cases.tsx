import { Boxes, Rocket, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const personas = [
  {
    icon: Rocket,
    title: "Solo product builders",
    description:
      "Launch billing@ and support@ on day one without paying for six Google seats you'll never log into.",
    example:
      "Indie SaaS founder ships invoices from billing@ and routes support tickets via webhook — $10/mo total.",
  },
  {
    icon: Boxes,
    title: "Multi-product managers",
    description:
      "Run separate domains per product with the same API pattern. Scale from one product to five without re-architecting email.",
    example:
      "Agency ships 4 client products: 4 domains × $10 = $40/mo vs $168/mo on Workspace.",
  },
  {
    icon: Users,
    title: "Platform & ops teams",
    description:
      "Centralize transactional send and inbound routing. Domain-scoped API keys keep each product isolated.",
    example:
      "Platform team issues one key per microservice domain. Admin@ alerts go to PagerDuty via webhook.",
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
            Email infrastructure for people who ship products
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Whether you&apos;re on product one or product ten, Relaybase keeps
            email cheap, predictable, and code-first.
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
