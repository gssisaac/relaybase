"use client";

import { normalizeWorkerUrl } from "@/lib/desktop/worker-url/worker-url";

export type SignupWorkerRole = "owner" | "team";

/** Step 1 — client-side Worker proof (same checks as signup; no session stored). */
export async function verifyWorkerForCloudSignup(input: {
  role: SignupWorkerRole;
  workerUrl: string;
  passtoken?: string;
  accountEmail?: string;
  teamPassword?: string;
}): Promise<void> {
  const workerUrl = normalizeWorkerUrl(input.workerUrl);
  if (!workerUrl) {
    throw new Error("Worker URL is required.");
  }

  if (input.role === "owner") {
    const passtoken = input.passtoken?.trim() ?? "";
    if (!passtoken) throw new Error("Passtoken is required.");
    const res = await fetch(`${workerUrl}/console/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passtoken, label: "hq-signup-verify" }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      throw new Error(data.error ?? "Could not verify passtoken with this Worker.");
    }
    return;
  }

  const accountEmail = input.accountEmail?.trim().toLowerCase() ?? "";
  const teamPassword = input.teamPassword ?? "";
  if (!accountEmail || !teamPassword) {
    throw new Error("Account email and password are required.");
  }
  const res = await fetch(`${workerUrl}/mobile/config`, {
    headers: {
      Authorization: `Bearer ${teamPassword}`,
      "X-Account-Email": accountEmail,
    },
  });
  if (!res.ok) {
    throw new Error("Could not verify teammate credentials with this Worker.");
  }
}
