/**
 * Install-success invariants. These exist because the mailbox gate and
 * Enable email API dialog have been re-broken across several Setup rewrites:
 *
 * 1. Reinstall / overwrite must always issue a new passtoken (never skip
 *    because D1 already has an owner).
 * 2. Enable email API opens only from the toolbar button — never from a
 *    success-screen useEffect.
 * 3. "Do this later" / email API skip must not unlock Go to Mailbox.
 *    The only mailbox gate is: issued passtoken copied or downloaded.
 */

export function canEnterMailboxAfterInstall(opts: {
  revealedPasstoken: string;
  tokenSaved: boolean;
  leavingToMailbox?: boolean;
}): boolean {
  if (opts.leavingToMailbox) return false;
  return Boolean(opts.revealedPasstoken.trim()) && opts.tokenSaved;
}

/** Always false. Kept so a future auto-open cannot land without failing tests. */
export function shouldAutoOpenEnableEmailApiAfterInstall(): false {
  return false;
}

export async function issuePasstokenWithRetry(
  setup: (input: {
    workerUrl: string;
    pepper: string;
  }) => Promise<{ passtoken: string }>,
  input: { workerUrl: string; pepper: string },
  opts?: {
    attempts?: number;
    delayMs?: number;
    sleep?: (ms: number) => Promise<void>;
  },
): Promise<{ passtoken: string }> {
  const attempts = Math.max(1, opts?.attempts ?? 3);
  const delayMs = opts?.delayMs ?? 1500;
  const sleep =
    opts?.sleep ?? ((ms) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const issued = await setup(input);
      if (!issued.passtoken?.trim()) {
        throw new Error("Worker did not return a passtoken");
      }
      return issued;
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) await sleep(delayMs);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}
