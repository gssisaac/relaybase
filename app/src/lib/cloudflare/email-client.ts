const API_BASE = "https://api.cloudflare.com/client/v4";

type CfResponse<T> = {
  success: boolean;
  errors?: Array<{ code?: number; message: string }>;
  result: T;
};

type CfLooseErrorBody = {
  code?: number;
  error?: string;
  message?: string;
  errors?: Array<{ code?: number; message: string }>;
  success?: boolean;
  result?: unknown;
};

function normalizeCfResponse<T>(raw: CfLooseErrorBody): CfResponse<T> {
  if (Array.isArray(raw.errors) || typeof raw.success === "boolean") {
    return raw as CfResponse<T>;
  }

  if (raw.code != null) {
    return {
      success: false,
      errors: [
        {
          code: raw.code,
          message: raw.error ?? raw.message ?? "Unknown error",
        },
      ],
      result: null as T,
    };
  }

  return {
    success: false,
    errors: [{ message: raw.error ?? raw.message ?? "Unknown error" }],
    result: null as T,
  };
}

export type CfEmailSendingSubdomain = {
  id: string;
  name: string;
  enabled: boolean;
  returnPathDomain?: string;
  dkimSelector?: string;
};

type CfEmailSendingSubdomainRaw = {
  id?: string;
  tag?: string;
  name: string;
  enabled: boolean;
  return_path_domain?: string;
  dkim_selector?: string;
};

function normalizeSendingSubdomain(
  raw: CfEmailSendingSubdomainRaw,
): CfEmailSendingSubdomain {
  const id = raw.tag?.trim() || raw.id?.trim() || "";
  return {
    id,
    name: raw.name,
    enabled: raw.enabled,
    returnPathDomain: raw.return_path_domain,
    dkimSelector: raw.dkim_selector,
  };
}

export type CfEmailSendingDnsRecord = {
  type: string;
  name: string;
  content: string;
  priority?: number;
  ttl?: number;
};

export type CfZoneInfo = {
  id: string;
  name: string;
  status: string;
  nameServers: string[];
};

export type CfEmailRoutingSettings = {
  id?: string;
  enabled: boolean;
  name?: string;
  status?: string;
};

export type CfDnsRecord = {
  id: string;
  type: string;
  name: string;
  content: string;
  proxied?: boolean;
  ttl?: number;
  priority?: number;
};

export type CloudflareEmailClientCredentials = {
  accountId: string;
  apiToken: string;
};

export class CloudflareEmailClient {
  private accountId: string;
  private apiToken: string;

  constructor(credentials: CloudflareEmailClientCredentials) {
    this.accountId = credentials.accountId;
    this.apiToken = credentials.apiToken;
  }

  static create(
    credentials: CloudflareEmailClientCredentials,
  ): CloudflareEmailClient {
    return new CloudflareEmailClient(credentials);
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiToken}`,
      "Content-Type": "application/json",
    };
  }

  private formatCfError(
    res: Response,
    data: CfResponse<unknown>,
    path: string,
    method?: string,
  ): Error {
    const details =
      data.errors
        ?.map((e) =>
          e.code != null ? `[${e.code}] ${e.message}` : e.message,
        )
        .join("; ") || `HTTP ${res.status}`;
    return new Error(
      `Cloudflare API: ${details}\nAPI: ${(method ?? "GET").toUpperCase()} ${path}`,
    );
  }

  private async request<T>(
    path: string,
    init?: RequestInit,
  ): Promise<CfResponse<T>> {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { ...this.headers(), ...init?.headers },
    });
    const raw = (await res.json()) as CfLooseErrorBody;
    const data = normalizeCfResponse<T>(raw);
    if (res.ok && data.success) return data;
    throw this.formatCfError(res, data, path, init?.method ?? "GET");
  }

  async resolveZoneId(domain: string): Promise<string | null> {
    const zone = await this.getZone(domain);
    return zone?.id ?? null;
  }

  private normalizeZone(zone: {
    id: string;
    name: string;
    status?: string;
    name_servers?: string[];
  }): CfZoneInfo {
    return {
      id: zone.id,
      name: zone.name,
      status: zone.status ?? "unknown",
      nameServers: (zone.name_servers ?? []).filter(Boolean),
    };
  }

  async getZone(domain: string): Promise<CfZoneInfo | null> {
    const accountFilter = this.accountId
      ? `&account.id=${encodeURIComponent(this.accountId)}`
      : "";
    const data = await this.request<
      Array<{
        id: string;
        name: string;
        status?: string;
        name_servers?: string[];
      }>
    >(`/zones?name=${encodeURIComponent(domain)}${accountFilter}`);
    const zone = data.result?.[0];
    if (!zone) return null;

    let info = this.normalizeZone(zone);
    // List responses occasionally omit name_servers — fetch the zone detail.
    if (!info.nameServers.length) {
      const detail = await this.request<{
        id: string;
        name: string;
        status?: string;
        name_servers?: string[];
      }>(`/zones/${zone.id}`);
      if (detail.result) {
        info = this.normalizeZone(detail.result);
      }
    }
    return info;
  }

  async listSendingSubdomains(zoneId: string): Promise<CfEmailSendingSubdomain[]> {
    const data = await this.request<CfEmailSendingSubdomainRaw[]>(
      `/zones/${zoneId}/email/sending/subdomains`,
    );
    return (data.result ?? []).map(normalizeSendingSubdomain);
  }

  async createSendingSubdomain(
    zoneId: string,
    name: string,
  ): Promise<CfEmailSendingSubdomain> {
    const data = await this.request<CfEmailSendingSubdomainRaw>(
      `/zones/${zoneId}/email/sending/subdomains`,
      {
        method: "POST",
        body: JSON.stringify({ name }),
      },
    );
    return normalizeSendingSubdomain(data.result);
  }

  async getSendingSubdomainDns(
    zoneId: string,
    subdomainId: string,
  ): Promise<CfEmailSendingDnsRecord[]> {
    const data = await this.request<CfEmailSendingDnsRecord[]>(
      `/zones/${zoneId}/email/sending/subdomains/${subdomainId}/dns`,
    );
    return data.result ?? [];
  }

  async getEmailRoutingSettings(zoneId: string): Promise<CfEmailRoutingSettings> {
    const data = await this.request<CfEmailRoutingSettings>(
      `/zones/${zoneId}/email/routing`,
    );
    return data.result;
  }

  async enableEmailRouting(zoneId: string): Promise<CfEmailRoutingSettings> {
    const data = await this.request<CfEmailRoutingSettings>(
      `/zones/${zoneId}/email/routing/enable`,
      { method: "POST", body: "{}" },
    );
    return data.result;
  }

  async listDnsRecords(
    zoneId: string,
    filters?: { type?: string; name?: string; perPage?: number },
  ): Promise<CfDnsRecord[]> {
    const params = new URLSearchParams();
    params.set("per_page", String(filters?.perPage ?? 100));
    if (filters?.type) params.set("type", filters.type);
    if (filters?.name) params.set("name", filters.name);
    const data = await this.request<CfDnsRecord[]>(
      `/zones/${zoneId}/dns_records?${params.toString()}`,
    );
    return data.result ?? [];
  }

  async deleteDnsRecord(zoneId: string, recordId: string): Promise<void> {
    await this.request<{ id: string }>(
      `/zones/${zoneId}/dns_records/${recordId}`,
      { method: "DELETE" },
    );
  }
}
