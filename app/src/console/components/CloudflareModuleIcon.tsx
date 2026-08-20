"use client";

import type { ReactElement, SVGProps } from "react";

/**
 * Cloudflare product icons — simplified, single-color (Cloudflare orange
 * `#F38020`) silhouettes that match the shapes Cloudflare uses in its
 * dashboard so users recognize each module at a glance.
 *
 * Used in the setup wizard "What we install" list.
 */

export type CloudflareModule = "Worker" | "KV" | "R2" | "D1";

const COLOR = "#F38020";

function WorkersIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill={COLOR} {...props}>
      <path d="M6.21 12.293l-3.215-4.3 3.197-4.178-.617-.842-3.603 4.712-.005.603 3.62 4.847.623-.842z" />
      <path d="M7.332 1.988H6.095l4.462 6.1-4.357 5.9h1.245L11.8 8.09 7.332 1.988z" />
      <path d="M9.725 1.988H8.472l4.533 6.027-4.533 5.973h1.255l4.303-5.67v-.603L9.725 1.988z" />
    </svg>
  );
}

function KvIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill={COLOR} {...props}>
      <path d="M5.5 11.238H3.75v-1H5.5v1zM3.75 9.237H5.5v-1H3.75v1zM5.5 7.237H3.75v-1H5.5v1zM6.5 11.238h5.75v-1H6.5v1zM12.25 9.237H6.5v-1h5.75v1zM6.5 7.237h5.75v-1H6.5v1z" />
      <path
        fillRule="evenodd"
        d="M1.5 3l.5-.5h4.75l.419.227.852 1.306H14l.5.5V13l-.5.5H2l-.5-.5V3zm1 .5v9h11V5.033H7.75l-.419-.227L6.48 3.5H2.5z"
      />
    </svg>
  );
}

function R2Icon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 256 256" fill={COLOR} {...props}>
      <path
        opacity="0.2"
        d="M216,80c0,26.51-39.4,48-88,48S40,106.51,40,80s39.4-48,88-48S216,53.49,216,80Z"
      />
      <path d="M128,24C74.17,24,32,48.6,32,80v96c0,31.4,42.17,56,96,56s96-24.6,96-56V80C224,48.6,181.83,24,128,24Zm80,104c0,9.62-7.88,19.43-21.61,26.92C170.93,163.35,150.19,168,128,168s-42.93-4.65-58.39-13.08C55.88,147.43,48,137.62,48,128V111.36c17.06,15,46.23,24.64,80,24.64s62.94-9.68,80-24.64ZM69.61,53.08C85.07,44.65,105.81,40,128,40s42.93,4.65,58.39,13.08C200.12,60.57,208,70.38,208,80s-7.88,19.43-21.61,26.92C170.93,115.35,150.19,120,128,120s-42.93-4.65-58.39-13.08C55.88,99.43,48,89.62,48,80S55.88,60.57,69.61,53.08ZM186.39,202.92C170.93,211.35,150.19,216,128,216s-42.93-4.65-58.39-13.08C55.88,195.43,48,185.62,48,176V159.36c17.06,15,46.23,24.64,80,24.64s62.94-9.68,80-24.64V176C208,185.62,200.12,195.43,186.39,202.92Z" />
    </svg>
  );
}

function D1Icon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill={COLOR} {...props}>
      <path
        fillRule="evenodd"
        d="m2.207 2.381 1.687-1.284L4.21 1h7.604l.313.102 1.736 1.285.215.423v9.98l-.145.362-1.268 1.343-.384.165H3.967l-.36-.142-1.439-1.342L2 12.79V2.81l.207-.429Zm.844 6.674 1.174 1.298h.014v1.05h-.48l-.708-.788v1.941l1.118 1.05h7.88l.972-1.026v-2.028l-.964.851H7.16v-1.05h4.505l1.363-1.211V7.188l-.964.853H7.16v-1.05h4.505l1.363-1.208V3.965l-.964.856H3.77l-.72-.735v1.607l1.175 1.298h.014v1.05h-.48l-.708-.788v1.802Zm8.59-7.004H4.388l-1.069.816.893.914h7.454l1.05-.935-1.073-.795Z"
      />
      <path d="M5.7 8.452a.788.788 0 1 1 0 1.576.788.788 0 0 1 0-1.576Zm-.93 3.858.93-.929.928.929-.929.928-.928-.928Zm.93-7.05.796.46v.92l-.797.46-.796-.46v-.92l.796-.46Z" />
    </svg>
  );
}

const MAP: Record<CloudflareModule, (p: SVGProps<SVGSVGElement>) => ReactElement> = {
  Worker: WorkersIcon,
  KV: KvIcon,
  R2: R2Icon,
  D1: D1Icon,
};

export function CloudflareModuleIcon({
  kind,
  className,
}: {
  kind: CloudflareModule;
  className?: string;
}) {
  const Icon = MAP[kind];
  return <Icon className={className} aria-hidden />;
}
