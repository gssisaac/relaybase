export type WorkerSignupProof =
  | { kind: "owner"; passtoken: string }
  | { kind: "team"; accountEmail: string; teamPassword: string };

function normalizeWorkerUrl(raw: string): string {
  return raw.trim().replace(/\/$/, "");
}

/** Prove Worker access for HQ signup. Passtoken / team password are never persisted. */
export async function verifyWorkerSignupProof(
  workerUrlRaw: string,
  proof: WorkerSignupProof,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const workerUrl = normalizeWorkerUrl(workerUrlRaw);
  if (!workerUrl || !/^https?:\/\//i.test(workerUrl)) {
    return { ok: false, error: "Enter a valid Worker URL." };
  }

  try {
    if (proof.kind === "owner") {
      const passtoken = proof.passtoken.trim();
      if (!passtoken) {
        return { ok: false, error: "Passtoken is required." };
      }
      const res = await fetch(`${workerUrl}/console/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passtoken, label: "hq-signup-verify" }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        return {
          ok: false,
          error: data.error ?? "Could not verify passtoken with this Worker.",
        };
      }
      return { ok: true };
    }

    const accountEmail = proof.accountEmail.trim().toLowerCase();
    const teamPassword = proof.teamPassword;
    if (!accountEmail || !teamPassword) {
      return { ok: false, error: "Account email and password are required." };
    }
    const res = await fetch(`${workerUrl}/mobile/config`, {
      headers: {
        Authorization: `Bearer ${teamPassword}`,
        "X-Account-Email": accountEmail,
      },
    });
    if (!res.ok) {
      return { ok: false, error: "Could not verify teammate credentials with this Worker." };
    }
    return { ok: true };
  } catch {
    return {
      ok: false,
      error: "Worker is unreachable. Check the URL and try again.",
    };
  }
}
