import { betaInvites } from "@/db/schema";
import { getDb } from "@/lib/cloudflare/kv";

const DOWNLOAD_ORIGIN = "https://relaybase.xyz";

export type BetaInviteLocale = {
  country?: string;
  city?: string;
  region?: string;
  timezone?: string;
};

export type BetaInviteDownload = {
  at: string;
};

export type BetaInviteRow = {
  uuid: string;
  email: string;
  createdAt: string;
  locale: BetaInviteLocale;
  browser: string;
  os: string;
  userAgent: string;
  downloads: BetaInviteDownload[];
  downloadCount: number;
  lastDownloadAt: string | null;
  downloadUrl: string;
};

export type ListBetaInvitesResult = {
  invites: BetaInviteRow[];
  available: boolean;
  message?: string;
};

type InviteDataBlob = {
  email?: string;
  createdAt?: string;
  locale?: BetaInviteLocale;
  browser?: string;
  os?: string;
  userAgent?: string;
  downloads?: BetaInviteDownload[];
};

function parseInviteData(raw: string): InviteDataBlob {
  try {
    return JSON.parse(raw) as InviteDataBlob;
  } catch {
    return {};
  }
}

function toInviteRow(row: {
  uuid: string;
  email: string;
  data: string;
}): BetaInviteRow {
  const parsed = parseInviteData(row.data);
  const downloads = Array.isArray(parsed.downloads) ? parsed.downloads : [];
  const lastDownloadAt =
    downloads.length > 0 ? (downloads[downloads.length - 1]?.at ?? null) : null;

  return {
    uuid: row.uuid,
    email: row.email,
    createdAt: parsed.createdAt ?? "",
    locale: parsed.locale ?? {},
    browser: parsed.browser ?? "Unknown",
    os: parsed.os ?? "Unknown",
    userAgent: parsed.userAgent ?? "",
    downloads,
    downloadCount: downloads.length,
    lastDownloadAt,
    downloadUrl: `${DOWNLOAD_ORIGIN}/downloads/${row.uuid}`,
  };
}

export async function listBetaInvites(): Promise<ListBetaInvitesResult> {
  const db = await getDb();
  if (!db) {
    return {
      invites: [],
      available: false,
      message:
        "D1 is not available in this environment. Deployed admin reads strum-relaybase-ops.",
    };
  }

  try {
    const rows = await db.select().from(betaInvites).all();
    const invites = rows
      .map(toInviteRow)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return { invites, available: true };
  } catch (error) {
    return {
      invites: [],
      available: false,
      message:
        "Could not read beta_invites from strum-relaybase-ops. Local Next may not have the table; deployed admin reads remote D1.",
    };
  }
}
