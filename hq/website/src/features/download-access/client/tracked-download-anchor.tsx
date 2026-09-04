"use client";

import { useEffect, type ComponentPropsWithoutRef } from "react";

import type { DownloadButtonLocation } from "../shared/types";
import { ensureDownloadClientId } from "./client-id";
import { getMacDownloadAction } from "./mac-download-action";

type TrackedDownloadAnchorProps = Omit<
  ComponentPropsWithoutRef<"a">,
  "href" | "onPointerDown"
> & {
  href: string;
  location: DownloadButtonLocation;
};

export function TrackedDownloadAnchor({
  href,
  location,
  ...props
}: TrackedDownloadAnchorProps) {
  useEffect(() => {
    ensureDownloadClientId();
  }, []);

  const action = getMacDownloadAction({ href, location });

  return (
    <a href={action.href} onPointerDown={action.onPointerDown} {...props} />
  );
}
