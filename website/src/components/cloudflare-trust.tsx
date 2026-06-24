import { Cloud, Globe2, Shield, Server, Zap } from "lucide-react";

import { Badge } from "@/components/ui/badge";

const stats = [
  { value: "330+", label: "cities worldwide" },
  { value: "99.99%", label: "uptime SLA" },
  { value: "0", label: "cold starts on Workers" },
];

export function CloudflareTrust() {
  return (
    <section
      id="infrastructure"
      className="border-y border-border bg-slate-900 py-20 text-white"
    >
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <Badge
              variant="outline"
              className="mb-4 border-slate-700 bg-slate-800 text-slate-300"
            >
              Infrastructure
            </Badge>
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
              Powered by Cloudflare —{" "}
              <span className="text-[#f6821f]">built for reliability</span>
            </h2>
            <p className="mt-4 text-lg text-slate-400">
              Relaybase runs on Cloudflare Workers, Email Routing, and Email
              Sending — the same global network that protects and accelerates
              millions of sites. Your product email inherits enterprise-grade
              delivery and edge-scale uptime.
            </p>

            <ul className="mt-8 space-y-4">
              {[
                {
                  icon: Shield,
                  text: "DDoS protection and WAF included — no extra security bill",
                },
                {
                  icon: Globe2,
                  text: "Global anycast network — low-latency send and receive worldwide",
                },
                {
                  icon: Server,
                  text: "No servers to patch, scale, or babysit — fully managed edge",
                },
                {
                  icon: Zap,
                  text: "Sub-millisecond cold starts on Workers — your webhooks respond fast",
                },
              ].map((item) => (
                <li key={item.text} className="flex items-start gap-3 text-sm text-slate-300">
                  <item.icon className="mt-0.5 size-4 shrink-0 text-[#f6821f]" />
                  {item.text}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-8">
            <div className="flex items-center gap-3">
              <div className="flex size-12 items-center justify-center rounded-xl bg-[#f6821f]/15">
                <Cloud className="size-6 text-[#f6821f]" />
              </div>
              <div>
                <p className="font-semibold">Cloudflare Partner Stack</p>
                <p className="text-sm text-slate-500">
                  Workers · Email Routing · Email Sending · R2 · KV
                </p>
              </div>
            </div>

            <div className="mt-8 grid grid-cols-3 gap-4">
              {stats.map((stat) => (
                <div key={stat.label} className="text-center">
                  <p className="text-2xl font-bold text-white">{stat.value}</p>
                  <p className="mt-1 text-xs text-slate-500">{stat.label}</p>
                </div>
              ))}
            </div>

            <div className="mt-8 rounded-lg border border-slate-800 bg-slate-900 p-4 font-mono text-xs text-slate-400">
              <p className="text-slate-500">{"// Your app"}</p>
              <p>fetch(&quot;/v1/send&quot;) ──▶</p>
              <p className="text-[#f6821f]">
                &nbsp;&nbsp;Cloudflare Worker (edge)
              </p>
              <p className="text-slate-500">
                &nbsp;&nbsp;&nbsp;&nbsp;──▶ Email Sending API
              </p>
              <p className="text-slate-500">
                &nbsp;&nbsp;&nbsp;&nbsp;──▶ Inbound → R2 + webhook
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
