import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  WEB_OWNER_SESSION_KEY,
  clearWebOwnerSessionStorage,
  hasStoredWebOwnerSession,
  readWebOwnerSession,
  writeWebOwnerSession,
} from "./web-owner-persist.ts";

function installWindow(opts: { desktop?: boolean } = {}) {
  const store = new Map<string, string>();
  const sessionStorage = {
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
    removeItem(key: string) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
  const win: Record<string, unknown> = { sessionStorage };
  if (opts.desktop) {
    win.__TAURI_INTERNALS__ = { invoke: async () => undefined };
  }
  (globalThis as { window?: unknown }).window = win;
  return store;
}

describe("web owner session persistence", () => {
  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
  });

  it("round-trips only the Worker URL and refresh tokens", () => {
    const store = installWindow();
    writeWebOwnerSession({
      workerUrl: "https://relaybase-api.acme.workers.dev/",
      mailRefreshToken: "mail-r",
      consoleRefreshToken: "console-r",
    });
    assert.deepEqual(JSON.parse(store.get(WEB_OWNER_SESSION_KEY)!), {
      workerUrl: "https://relaybase-api.acme.workers.dev",
      mailRefreshToken: "mail-r",
      consoleRefreshToken: "console-r",
    });
    assert.deepEqual(readWebOwnerSession(), {
      workerUrl: "https://relaybase-api.acme.workers.dev",
      mailRefreshToken: "mail-r",
      consoleRefreshToken: "console-r",
    });
    assert.equal(hasStoredWebOwnerSession(), true);
  });

  it("does not persist extra fields such as access tokens or passtokens", () => {
    const store = installWindow();
    writeWebOwnerSession({
      workerUrl: "https://w.example",
      mailRefreshToken: "m",
      consoleRefreshToken: "c",
      accessToken: "jwt",
      passtoken: "rb_pass_x",
    } as never);
    const raw = store.get(WEB_OWNER_SESSION_KEY)!;
    assert.equal(raw.includes("jwt"), false);
    assert.equal(raw.includes("rb_pass_"), false);
  });

  it("removes the key when there is no refresh token or Worker URL", () => {
    const store = installWindow();
    store.set(WEB_OWNER_SESSION_KEY, "{}");
    writeWebOwnerSession({
      workerUrl: "https://w.example",
      mailRefreshToken: "",
      consoleRefreshToken: "",
    });
    assert.equal(store.has(WEB_OWNER_SESSION_KEY), false);

    writeWebOwnerSession({
      workerUrl: "",
      mailRefreshToken: "m",
      consoleRefreshToken: "c",
    });
    assert.equal(store.has(WEB_OWNER_SESSION_KEY), false);
  });

  it("clears storage", () => {
    const store = installWindow();
    writeWebOwnerSession({
      workerUrl: "https://w.example",
      mailRefreshToken: "m",
      consoleRefreshToken: "c",
    });
    clearWebOwnerSessionStorage();
    assert.equal(store.has(WEB_OWNER_SESSION_KEY), false);
    assert.equal(readWebOwnerSession(), null);
  });

  it("ignores malformed JSON", () => {
    const store = installWindow();
    store.set(WEB_OWNER_SESSION_KEY, "{not json");
    assert.equal(readWebOwnerSession(), null);
  });

  it("never reads or writes on desktop", () => {
    const store = installWindow({ desktop: true });
    store.set(
      WEB_OWNER_SESSION_KEY,
      JSON.stringify({
        workerUrl: "https://w.example",
        mailRefreshToken: "m",
        consoleRefreshToken: "c",
      }),
    );
    assert.equal(readWebOwnerSession(), null);
    writeWebOwnerSession({
      workerUrl: "https://other.example",
      mailRefreshToken: "m2",
      consoleRefreshToken: "c2",
    });
    clearWebOwnerSessionStorage();
    assert.equal(
      JSON.parse(store.get(WEB_OWNER_SESSION_KEY)!).workerUrl,
      "https://w.example",
    );
  });

  it("returns null without a window", () => {
    assert.equal(readWebOwnerSession(), null);
    assert.equal(hasStoredWebOwnerSession(), false);
  });
});
