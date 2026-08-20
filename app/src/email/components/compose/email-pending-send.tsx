"use client";

import { toast } from "sonner";

import { UnsendToastBody } from "@/email/components/compose/UnsendToast";

export const EMAIL_UNSEND_MS = 5_000;

type PendingSend = {
  timer: ReturnType<typeof setTimeout>;
  cancelled: boolean;
};

const pendingByToastId = new Map<string | number, PendingSend>();

export type ScheduleEmailSendOptions = {
  /** Runs after the unsend window if not cancelled. */
  execute: () => void | Promise<void>;
  /** Runs when the user clicks Unsend. */
  onUnsend: () => void;
  durationMs?: number;
};

/**
 * Show a "Sending in Ns" toast with countdown + Unsend, then run `execute`
 * after `durationMs` unless cancelled. Unsend via button or Escape.
 * Swiping the toast away does not cancel.
 */
export function scheduleEmailSend(options: ScheduleEmailSendOptions): {
  toastId: string | number;
} {
  const durationMs = options.durationMs ?? EMAIL_UNSEND_MS;
  const toastId = toast.custom(
    (id) => (
      <UnsendToastBody
        durationMs={durationMs}
        onUnsend={() => {
          const pending = pendingByToastId.get(id);
          if (!pending || pending.cancelled) return;
          pending.cancelled = true;
          clearTimeout(pending.timer);
          pendingByToastId.delete(id);
          toast.dismiss(id);
          options.onUnsend();
        }}
      />
    ),
    {
      duration: Infinity,
      unstyled: true,
      className: "w-auto!",
    },
  );

  const pending: PendingSend = {
    cancelled: false,
    timer: setTimeout(() => {
      const current = pendingByToastId.get(toastId);
      if (!current || current.cancelled) return;
      pendingByToastId.delete(toastId);
      toast.dismiss(toastId);
      void options.execute();
    }, durationMs),
  };
  pendingByToastId.set(toastId, pending);

  return { toastId };
}
