import type { InviteData, WorkerEnv } from "./types";

export async function getInviteByUuid(
  env: WorkerEnv,
  uuid: string,
): Promise<{ uuid: string; email: string; data: InviteData } | null> {
  const row = await env.DB.prepare(
    "SELECT uuid, email, data FROM beta_invites WHERE uuid = ?",
  )
    .bind(uuid)
    .first<{ uuid: string; email: string; data: string }>();
  if (!row) return null;
  return { uuid: row.uuid, email: row.email, data: parseInviteData(row.data) };
}

export async function getInviteByEmail(
  env: WorkerEnv,
  email: string,
): Promise<{ uuid: string; email: string; data: InviteData } | null> {
  const row = await env.DB.prepare(
    "SELECT uuid, email, data FROM beta_invites WHERE email = ?",
  )
    .bind(email)
    .first<{ uuid: string; email: string; data: string }>();
  if (!row) return null;
  return { uuid: row.uuid, email: row.email, data: parseInviteData(row.data) };
}

export async function insertInvite(
  env: WorkerEnv,
  uuid: string,
  data: InviteData,
): Promise<void> {
  await env.DB.prepare(
    "INSERT INTO beta_invites (uuid, email, data) VALUES (?, ?, ?)",
  )
    .bind(uuid, data.email, JSON.stringify(data))
    .run();
}

export async function appendDownload(
  env: WorkerEnv,
  uuid: string,
  at: string,
): Promise<InviteData | null> {
  const invite = await getInviteByUuid(env, uuid);
  if (!invite) return null;
  const next: InviteData = {
    ...invite.data,
    downloads: [...invite.data.downloads, { at }],
  };
  await env.DB.prepare("UPDATE beta_invites SET data = ? WHERE uuid = ?")
    .bind(JSON.stringify(next), uuid)
    .run();
  return next;
}

function parseInviteData(raw: string): InviteData {
  const parsed = JSON.parse(raw) as InviteData;
  return {
    email: parsed.email,
    createdAt: parsed.createdAt,
    locale: parsed.locale ?? {},
    browser: parsed.browser ?? "Unknown",
    os: parsed.os ?? "Unknown",
    userAgent: parsed.userAgent ?? "",
    downloads: Array.isArray(parsed.downloads) ? parsed.downloads : [],
  };
}
