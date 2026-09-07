import Image from "next/image";

import type { ReleaseInfo } from "@/lib/resolve-release";

import { TrackedDownloadAnchor } from "@/features/download-access/client";

type BetaDownloadCardProps = {
  release: ReleaseInfo;
};

export function BetaDownloadCard({ release }: BetaDownloadCardProps) {
  const versionLabel = release.version;
  const siliconLabel = versionLabel
    ? `Download ${versionLabel} · Apple Silicon`
    : "Download · Apple Silicon";
  const siliconHref = release.dmgUrlAarch64;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#f8fafc] px-5 py-8">
      <div className="w-full max-w-md rounded-2xl border border-[#e2e8f0] bg-white px-7 py-8 text-center shadow-sm">
        <Image
          src="/icon.png"
          alt=""
          width={48}
          height={48}
          className="mx-auto size-12"
        />
        <div className="mt-4 inline-block rounded-full bg-[#ccfbf1] px-2.5 py-0.5 text-xs font-semibold text-[#0f766e]">
          Beta
        </div>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-[#0f172a]">
          Download Relaybase
        </h1>
        <p className="mt-2.5 text-[0.95rem] leading-relaxed text-[#64748b]">
          Mac for Apple Silicon is available now. Windows is coming soon.
        </p>

        <div className="mt-6 grid gap-3 text-left">
          <div className="rounded-xl border border-[#e2e8f0] bg-white px-4 py-3.5">
            <div className="text-xs font-semibold uppercase tracking-wide text-[#64748b]">
              Mac · Apple Silicon
            </div>
            {siliconHref ? (
              <>
                <TrackedDownloadAnchor
                  href={siliconHref}
                  location="beta-page"
                  className="mt-2.5 inline-block rounded-[0.6rem] bg-[#e85d2a] px-[1.15rem] py-2.5 text-[0.95rem] font-semibold text-white no-underline hover:brightness-95"
                >
                  {siliconLabel}
                </TrackedDownloadAnchor>
                <p className="mt-1.5 text-xs leading-snug text-[#64748b]">
                  M1, M2, M3, M4 and later
                </p>
              </>
            ) : (
              <p className="mt-2.5 text-sm text-[#b91c1c]">
                The Apple Silicon installer is not available yet. Try again
                shortly.
              </p>
            )}
          </div>

          <div className="rounded-xl border border-[#e2e8f0] bg-[#f1f5f9] px-4 py-3.5">
            <div className="text-xs font-semibold uppercase tracking-wide text-[#64748b]">
              Windows
            </div>
            <p className="mt-1.5 text-[0.95rem] font-semibold text-[#64748b]">
              Coming soon
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
