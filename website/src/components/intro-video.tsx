import { Badge } from "@/components/ui/badge";

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

        <div className="mx-auto mt-8 max-w-3xl overflow-hidden rounded-2xl border border-border bg-black shadow-sm">
          <video
            className="aspect-video w-full"
            controls
            playsInline
            preload="metadata"
            poster="/video/relaybase-intro-poster.jpg"
          >
            <source src="/video/relaybase-intro.mp4" type="video/mp4" />
          </video>
        </div>
      </div>
    </section>
  );
}
