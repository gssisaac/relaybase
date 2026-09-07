"use client";

import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { faqGroups } from "@/lib/faq-data";

const faqItems = faqGroups.flatMap((group) => group.items);

export function FaqSection() {
  return (
    <section id="faq" className="border-t border-border bg-panel py-20">
      <div className="mx-auto max-w-3xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <Badge variant="outline" className="mb-4">
            FAQ
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            Common questions
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Google Workspace coexistence, data privacy, Cloudflare requirements,
            and what Relaybase actually ships today.
          </p>
        </div>

        <div className="mt-12 overflow-hidden rounded-2xl border border-border/80 bg-white shadow-sm">
          <Accordion multiple>
            {faqItems.map((item) => (
              <AccordionItem key={item.id} value={item.id}>
                <AccordionTrigger>{item.question}</AccordionTrigger>
                <AccordionContent>{item.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
}
