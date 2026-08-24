import { Cloud, KeyRound, MonitorSmartphone, Shield, Zap } from "lucide-react";

import { Badge } from "@/components/ui/badge";

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
              Your infrastructure
            </Badge>
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
              Built for{" "}
              <span className="text-[#f6821f]">your Cloudflare account</span>
            </h2>
            <p className="mt-4 text-lg text-slate-400">
              Relaybase does not host email for you. You deploy our routing Worker
              into your Cloudflare account with Wrangler; the Mac app only needs
              your Worker URL and admin token — then you get an inbox UX over
              Cloudflare Email Sending and Routing.
            </p>

            <ul className="mt-8 space-y-4">
              {[
                {
                  icon: KeyRound,
                  text: "No Workers/D1/R2 API token in the Mac app — you deploy; we never hold account edit rights",
                },
                {
                  icon: MonitorSmartphone,
                  text: "Worker, D1, and R2 live in your account — we ship the install ZIP, you own the runtime",
                },
                {
                  icon: Shield,
                  text: "No nameserver hand-off to Relaybase — domains stay on your Cloudflare zones",
                },
                {
                  icon: Zap,
                  text: "Skip days of CF Email setup — addresses, routing rules, and API keys in minutes",
                },
              ].map((item) => (
                <li
                  key={item.text}
                  className="flex items-start gap-3 text-sm text-slate-300"
                >
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
                <p className="font-semibold">Your Cloudflare stack</p>
                <p className="text-sm text-slate-500">
                  Workers · Email Routing · Email Sending · R2 · D1
                </p>
              </div>
            </div>

            <div className="mt-8 rounded-lg border border-slate-800 bg-slate-900 p-4 font-mono text-xs text-slate-400">
              <p className="text-slate-500">{"// You deploy"}</p>
              <p>wrangler deploy ──▶ relaybase-api in your account</p>
              <p className="text-[#f6821f]">
                Relaybase.app ──▶ your Worker URL + admin token
              </p>
              <p className="text-slate-500">
                &nbsp;&nbsp;&nbsp;&nbsp;──▶ Email Sending API (your bill)
              </p>
              <p className="text-slate-500">
                &nbsp;&nbsp;&nbsp;&nbsp;──▶ Inbound → your R2 + webhook
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
