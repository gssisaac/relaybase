export function parseJsonBody<T extends Record<string, unknown>>(c: {
  req: { json: () => Promise<T> };
}): Promise<T | null> {
  return c.req.json().catch(() => null);
}
