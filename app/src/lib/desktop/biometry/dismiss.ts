const DISMISSED_BIOMETRY_CODES = new Set([
  "usercancel",
  "appcancel",
  "systemcancel",
  "userfallback",
]);

function normalizeCode(value: string): string {
  return value.toLowerCase().replace(/[_\s-]/g, "");
}

function dismissedCode(value: string): boolean {
  const code = normalizeCode(value);
  if (DISMISSED_BIOMETRY_CODES.has(code)) return true;
  return code.endsWith("cancel") || code.endsWith("cancelled") || code.endsWith("canceled");
}

function biometryMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const o = err as { message?: unknown };
    if (typeof o.message === "string") return o.message;
  }
  return "";
}

/** macOS cancels LAContext when the window is not yet key (typical at launch). */
export function isSystemCanceledBiometry(err: unknown): boolean {
  return /systemcancel/i.test(biometryMessage(err));
}

/** True when the OS prompt was dismissed — not an error to show in the UI. */
export function isUserDismissedBiometry(err: unknown): boolean {
  if (err == null) return false;
  if (typeof err === "object") {
    const o = err as { errorCode?: unknown; code?: unknown; message?: unknown };
    const rawCode = o.errorCode ?? o.code;
    if (typeof rawCode === "string" && dismissedCode(rawCode)) return true;
    if (typeof o.message === "string" && isDismissedBiometryMessage(o.message)) {
      return true;
    }
  }
  if (err instanceof Error) return isDismissedBiometryMessage(err.message);
  if (typeof err === "string") return isDismissedBiometryMessage(err);
  return false;
}

function isDismissedBiometryMessage(message: string): boolean {
  const text = message.trim();
  if (!text) return false;
  const bracket = text.match(/^\[([^\]]+)\]/);
  if (bracket && dismissedCode(bracket[1])) return true;
  const lower = text.toLowerCase();
  if (lower.includes("usercancel") || lower.includes("appcancel") || lower.includes("systemcancel")) {
    return true;
  }
  if (lower.includes("user fallback") || lower.includes("userfallback")) return true;
  return /authentication cancel+ed/.test(lower);
}
