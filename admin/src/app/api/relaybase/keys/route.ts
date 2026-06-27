import { NextResponse } from "next/server";

import {
  createEmailSenderKey,
  listEmailSenderKeys,
} from "@/relaybase/lib/client";
import { requireRelaybaseAdminAuth, RelaybaseAuthError } from "@/relaybase/lib/auth";
import {
  addEmailSenderKeyToVault,
  readEmailSenderSettings,
} from "@/relaybase/lib/settings";
import { apiError } from "@/lib/api/api-error";

function relaybaseApiError(error: unknown) {
  if (error instanceof RelaybaseAuthError) {
    return apiError(error, 401);
  }
  return apiError(error);
}

export async function GET(request: Request) {
  try {
    const cfg = await requireRelaybaseAdminAuth(request);
    const keys = await listEmailSenderKeys(cfg);
    const vault = readEmailSenderSettings().apiKeyVault;
    const vaultById = new Map(vault.map((entry) => [entry.id, entry]));

    return NextResponse.json({
      keys: keys.map((key) => {
        const stored = vaultById.get(key.id);
        return {
          ...key,
          apiKey: stored?.key ?? null,
          storedLocally: Boolean(stored?.key),
        };
      }),
    });
  } catch (error) {
    return relaybaseApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { domain?: string; label?: string };
    const domain = body.domain?.trim();
    if (!domain) {
      return NextResponse.json({ error: "domain is required" }, { status: 400 });
    }

    const cfg = await requireRelaybaseAdminAuth(request);
    const result = await createEmailSenderKey(cfg, {
      domain,
      label: body.label,
    });

    addEmailSenderKeyToVault({
      id: result.id,
      domain: result.domain,
      label: result.label,
      keyPrefix: result.apiKey.replace(/^fes_/, "").slice(0, 8),
      key: result.apiKey,
      createdAt: result.createdAt,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return relaybaseApiError(error);
  }
}
