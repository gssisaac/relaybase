"use client";

import { Accordion as AccordionPrimitive } from "@base-ui/react/accordion";
import { ChevronDown, ChevronUp } from "lucide-react";

import { cn } from "@/lib/utils";

function Accordion({ className, ...props }: AccordionPrimitive.Root.Props) {
  return (
    <AccordionPrimitive.Root
      data-slot="accordion"
      className={cn("flex w-full flex-col", className)}
      {...props}
    />
  );
}

function AccordionItem({ className, ...props }: AccordionPrimitive.Item.Props) {
  return (
    <AccordionPrimitive.Item
      data-slot="accordion-item"
      className={cn("not-last:border-b not-last:border-border/60", className)}
      {...props}
    />
  );
}

function AccordionTrigger({
  className,
  children,
  ...props
}: AccordionPrimitive.Trigger.Props) {
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        data-slot="accordion-trigger"
        className={cn(
          "group/accordion-trigger relative flex flex-1 items-start justify-between gap-4 px-5 py-4 text-left text-base font-normal transition-colors outline-none hover:text-brand focus-visible:ring-3 focus-visible:ring-ring/50 aria-disabled:pointer-events-none aria-disabled:opacity-50 **:data-[slot=accordion-trigger-icon]:shrink-0 **:data-[slot=accordion-trigger-icon]:text-muted-foreground",
          className,
        )}
        {...props}
      >
        <span className="pr-2">{children}</span>
        <ChevronDown
          data-slot="accordion-trigger-icon"
          className="pointer-events-none mt-1 size-4 group-aria-expanded/accordion-trigger:hidden"
        />
        <ChevronUp
          data-slot="accordion-trigger-icon"
          className="pointer-events-none mt-1 hidden size-4 group-aria-expanded/accordion-trigger:inline"
        />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  );
}

function AccordionContent({
  className,
  children,
  ...props
}: AccordionPrimitive.Panel.Props) {
  return (
    <AccordionPrimitive.Panel
      data-slot="accordion-content"
      className="overflow-hidden text-sm data-open:animate-accordion-down data-closed:animate-accordion-up"
      {...props}
    >
      <div
        className={cn(
          "h-(--accordion-panel-height) px-5 pb-5 text-muted-foreground data-ending-style:h-0 data-starting-style:h-0 [&_a]:text-brand [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-brand-hover [&_code]:rounded [&_code]:bg-well [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-foreground/80 [&_li]:leading-relaxed [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-5 [&_p+p]:mt-3 [&_strong]:font-normal [&_strong]:text-foreground [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5",
          className,
        )}
      >
        {children}
      </div>
    </AccordionPrimitive.Panel>
  );
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
