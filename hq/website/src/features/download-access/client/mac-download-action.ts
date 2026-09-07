"use client";

import type { PointerEvent } from "react";

import { siteConfig } from "@/lib/site-config";

import { DOWNLOAD_ACCESS_MODE } from "../shared/constants";
import type { DownloadButtonLocation } from "../shared/types";
import { trackDirectDownloadAsync } from "./track-direct-download";

export type MacDownloadAction = {
  href: string;
  onPointerDown: (event: PointerEvent<HTMLAnchorElement>) => void;
};

export function getMacDownloadAction(opts: {
  href: string;
  location: DownloadButtonLocation;
}): MacDownloadAction {
  if (DOWNLOAD_ACCESS_MODE === "email") {
    return {
      href: siteConfig.getStartedPath,
      onPointerDown: () => {},
    };
  }

  return {
    href: opts.href,
    onPointerDown: (event) => {
      if (event.button !== 0) return;
      trackDirectDownloadAsync({ arch: "aarch64" });
    },
  };
}
