import { Badge } from "@/components/ui/badge";

export function IntroVideo() {
  return (
    <section className="border-b border-border bg-well py-16 md:py-20">
      <div className="mx-auto max-w-[1000px] px-6">
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

        <div className="mx-auto mt-8 w-full max-w-[1000px] overflow-hidden rounded-3xl border border-border bg-black shadow-sm">
          <video
            className="aspect-[1280/898] h-auto w-full object-cover"
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            poster="/video/relaybase-intro-poster.jpg"
          >
            <source src="/video/relaybase-intro.mp4" type="video/mp4" />
          </video>
        </div>
      </div>
    </section>
  );
}
