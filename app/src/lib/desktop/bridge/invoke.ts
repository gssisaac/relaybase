type TauriInvoke = <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;

function getInvoke(): TauriInvoke | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    __TAURI_INTERNALS__?: { invoke: TauriInvoke };
    __TAURI__?: { core?: { invoke: TauriInvoke } };
  };
  return w.__TAURI_INTERNALS__?.invoke ?? w.__TAURI__?.core?.invoke ?? null;
}

export function isDesktopRuntime(): boolean {
  return getInvoke() !== null;
}

/** Normalize Tauri invoke / JS errors into a readable string. */
export function formatDesktopError(err: unknown): string {
  if (typeof err === "string" && err.trim()) return err.trim();
  if (err instanceof Error && err.message.trim()) return err.message.trim();
  if (err && typeof err === "object") {
    const o = err as Record<string, unknown>;
    if (typeof o.message === "string" && o.message.trim()) return o.message.trim();
    if (typeof o.error === "string" && o.error.trim()) return o.error.trim();
    try {
      const json = JSON.stringify(err);
      if (json && json !== "{}" && json !== "null") return json;
    } catch {
      /* ignore */
    }
  }
  return "Unknown error";
}

export async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const fn = getInvoke();
  if (!fn) throw new Error("Not running inside the Relaybase desktop app");
  try {
    return await fn<T>(cmd, args);
  } catch (err) {
    // Tauri rejects with a raw string / object, not always Error.
    throw new Error(formatDesktopError(err));
  }
}

export async function desktopGetInfo(): Promise<{ isDesktop: boolean; version: string }> {
  return invoke("get_desktop_info");
}
