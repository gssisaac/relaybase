import { isUserDismissedBiometry } from "../biometry/dismiss";

export function visibleUnlockError(err: unknown): string | null {
  if (isUserDismissedBiometry(err)) return null;
  const message = err instanceof Error ? err.message : String(err ?? "");
  if (!message.trim() || isUserDismissedBiometry(message)) return null;
  return message;
}
