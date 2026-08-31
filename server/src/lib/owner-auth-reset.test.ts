import { describe, expect, it, vi, beforeEach } from "vitest";

import { discoverRecoverAccount, normalizeCfAccountId, resetOwner, verifyCfTokenSecretsStore } from "./owner-auth";

vi.mock("../../db/app", () => ({
  createAppDb: vi.fn(() => ({})),
}));

vi.mock("../../db/app/owner", () => ({
  setOwnerLogin: vi.fn(async () => undefined),
  setOwnerCfAccountId: vi.fn(async () => undefined),
}));

vi.mock("../../db/app/owner-sessions", () => ({
  deleteAllOwnerSessions: vi.fn(async () => undefined),
}));

describe("resetOwner cfAccountId fallback", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("uses cfAccountId when CF_ACCOUNT_ID env is empty", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/secrets_store/stores")) {
        return new Response(JSON.stringify({ success: true }), { status: 200 });
      }
      return new Response(JSON.stringify({ success: false }), { status: 403 });
    });

    const env = {
      RELAYBASE_DB: {},
      AUTH_PEPPER: "pepper",
      CF_ACCOUNT_ID: "",
    } as never;

    const result = await resetOwner(env, {
      cfAccessToken: "oauth-token",
      cfAccountId: "3adf03d991843094a7343eebc0a98007",
    });

    expect("passtoken" in result).toBe(true);
    if ("passtoken" in result) {
      expect(result.passtoken.startsWith("rb_pass_")).toBe(true);
    }
  });

  it("discovers account from token when env and body are empty", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/accounts?")) {
        return new Response(
          JSON.stringify({
            success: true,
            result: [{ id: "3adf03d991843094a7343eebc0a98007" }],
          }),
          { status: 200 },
        );
      }
      if (url.includes("/secrets_store/stores")) {
        return new Response(JSON.stringify({ success: true }), { status: 200 });
      }
      return new Response(JSON.stringify({ success: false }), { status: 403 });
    });

    const env = {
      RELAYBASE_DB: {},
      AUTH_PEPPER: "pepper",
      CF_ACCOUNT_ID: "",
    } as never;

    const result = await resetOwner(env, {
      cfAccessToken: "oauth-token",
    });

    expect("passtoken" in result).toBe(true);
  });
});

describe("discoverRecoverAccount", () => {
  it("returns first account with secrets-store access", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/accounts?")) {
        return new Response(
          JSON.stringify({ success: true, result: [{ id: "acct-1" }] }),
          { status: 200 },
        );
      }
      if (url.includes("/secrets_store/stores")) {
        return new Response(JSON.stringify({ success: true }), { status: 200 });
      }
      return new Response(JSON.stringify({ success: false }), { status: 403 });
    });
    const id = await discoverRecoverAccount("token");
    expect(id).toBe("acct-1");
  });
});

describe("normalizeCfAccountId", () => {
  it("rejects binding placeholder strings", () => {
    expect(normalizeCfAccountId("cf_account_id")).toBeNull();
    expect(normalizeCfAccountId("CF_ACCOUNT_ID")).toBeNull();
  });

  it("accepts 32-char hex ids", () => {
    expect(normalizeCfAccountId("3adf03d991843094a7343eebc0a98007")).toBe(
      "3adf03d991843094a7343eebc0a98007",
    );
  });
});

describe("verifyCfTokenSecretsStore", () => {
  it("accepts secrets-store list success", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ success: true }), { status: 200 }),
    );
    const out = await verifyCfTokenSecretsStore("token", "acct");
    expect(out.ok).toBe(true);
  });
});
