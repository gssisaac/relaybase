export function bearerToken(c: {
  req: { header: (name: string) => string | undefined };
}): string | null {
  const auth = c.req.header("Authorization")?.trim();
  if (!auth?.startsWith("Bearer ")) return null;
  return auth.slice(7).trim() || null;
}
