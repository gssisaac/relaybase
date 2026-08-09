import { PlayCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";

/**
 * PLACEHOLDER — swap the dashed box below for the real 60-second intro
 * video embed once it's produced. Section chrome (badge, heading, layout)
 * is final; only the media itself is a stand-in.
 */
export function IntroVideo() {
  return (
    <section className="border-b border-border bg-well py-16 md:py-20">
      <div className="mx-auto max-w-4xl px-6">
        <div className="mx-auto max-w-xl text-center">
          <Badge variant="outline" className="mb-4 bg-white">
            60-second intro
          </Badge>
          <h2 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
            See it running on a real Cloudflare account
          </h2>
          <p className="mt-3 text-muted-foreground">
            Install, connect a domain, and send the first email — in one
            minute, no editing.
          </p>
        </div>

        <div className="mx-auto mt-8 flex aspect-video max-w-3xl flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border bg-white/60">
          <PlayCircle className="size-12 text-muted-foreground/40" />
          <p className="text-sm font-medium text-muted-foreground">
            Video coming soon
          </p>
        </div>
      </div>
    </section>
  );
}
