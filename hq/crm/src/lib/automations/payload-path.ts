/** Read a dotted path from a JSON object (e.g. `data.email`). */
export function readPayloadPath(payload: Record<string, unknown>, path: string): unknown {
  const segments = path.split(".").map((s) => s.trim()).filter(Boolean);
  let current: unknown = payload;
  for (const segment of segments) {
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

export function readPayloadString(payload: Record<string, unknown>, path: string): string | null {
  const value = readPayloadPath(payload, path);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

export function payloadHasRequiredFields(
  payload: Record<string, unknown>,
  requiredFields: string[] | undefined,
): boolean {
  if (!requiredFields?.length) return true;
  for (const field of requiredFields) {
    const value = readPayloadPath(payload, field);
    if (value === undefined || value === null) return false;
    if (typeof value === "string" && !value.trim()) return false;
  }
  return true;
}
