export const TRIGGER_CONFIG_INSPECTOR_WIDTH_PX = 500;

export const TRIGGER_CONFIG_INSPECTOR_TRANSITION_MS = 200;

const OPEN_KEY = "relaybase:trigger-config-inspector-open";

export function readTriggerConfigInspectorOpen(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = sessionStorage.getItem(OPEN_KEY);
    if (raw === "1") return true;
    if (raw === "0") return false;
  } catch {
    // ignore
  }
  return false;
}

export function writeTriggerConfigInspectorOpen(open: boolean) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(OPEN_KEY, open ? "1" : "0");
  } catch {
    // ignore
  }
}
