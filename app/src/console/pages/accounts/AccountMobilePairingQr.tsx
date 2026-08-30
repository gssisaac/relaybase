"use client";

// Parked for post-launch mobile companion — do not import until mobile ships.

import { QrCode as QrCodeIcon } from "lucide-react";

import { QrCode } from "@/components/ui/qr-code";
import { resolveEmailApiBase } from "@/lib/desktop/api";
import { buildConnectDeepLink } from "@/lib/desktop/mobile";

type AccountMobilePairingQrProps = {
  email: string;
  /** One-shot plain password after generate — required to build the deep link. */
  plainPassword: string | null;
  hasPassword: boolean;
};

/**
 * Pairing QR for the Flutter companion (`relaybase://connect`). Encode the
 * Worker URL + account email + per-account password so the app can scan and
 * auto-fill Connect.
 */
export function AccountMobilePairingQr({
  email,
  plainPassword,
  hasPassword,
}: AccountMobilePairingQrProps) {
  const emailKey = email.trim().toLowerCase();
  const workerUrl = resolveEmailApiBase();
  const showQr =
    hasPassword &&
    Boolean(workerUrl) &&
    plainPassword &&
    plainPassword.trim().length > 0;
  const deepLink = showQr
    ? buildConnectDeepLink({
        workerUrl: workerUrl,
        email: emailKey,
        password: plainPassword!.trim(),
      })
    : null;

  if (showQr && deepLink) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-md border border-border/60 bg-white p-3">
        <QrCode value={deepLink} size={192} />
        <p className="text-[11px] text-muted-foreground">
          Scan with the Relaybase mobile app
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-md border border-dashed border-border/60 p-3 text-xs text-muted-foreground">
      <QrCodeIcon className="size-4" aria-hidden />
      {hasPassword
        ? "Generating password to show the pairing QR…"
        : "Generate a password to show the pairing QR."}
    </div>
  );
}
