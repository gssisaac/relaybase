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
  CF_WORKERS_PLANS_URL,
  type CloudflarePlanErrorInput,
  isCloudflarePlanError,
} from "./plan-required";

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
              window.open(CF_WORKERS_PLANS_URL, "_blank", "noopener,noreferrer");
            }}
          >
            Open Cloudflare Workers plans
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
