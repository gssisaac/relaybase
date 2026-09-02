"use client";

import { useEffect, useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import {
  CF_PLAN_DIALOG_MESSAGE,
  type CloudflarePlanErrorInput,
  isCloudflarePlanError,
} from "./plan-required";
import { cloudflareEmailSendingUrl, connectedCfAccountId } from "@/lib/desktop/bridge";
import { useOptionalDesktop } from "@/lib/desktop/shell";

type OpenListener = () => void;

let openListener: OpenListener | null = null;

/** Opens the Workers Paid dialog when `error` is plan-related. Returns true if shown. */
export function notifyIfCloudflarePlanError(
  error: CloudflarePlanErrorInput,
): boolean {
  if (!isCloudflarePlanError(error)) return false;
  openListener?.();
  return true;
}

export function CloudflarePlanDialogHost() {
  const [open, setOpen] = useState(false);
  const desktop = useOptionalDesktop();
  const emailSendingUrl = cloudflareEmailSendingUrl(
    connectedCfAccountId(desktop?.credentials),
  );

  useEffect(() => {
    openListener = () => setOpen(true);
    return () => {
      openListener = null;
    };
  }, []);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Workers Paid plan required</AlertDialogTitle>
          <AlertDialogDescription>{CF_PLAN_DIALOG_MESSAGE}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Dismiss</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              window.open(emailSendingUrl, "_blank", "noopener,noreferrer");
            }}
          >
            Open Cloudflare Email Sending
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
