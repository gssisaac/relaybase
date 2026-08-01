import {
  cloudflarePermissionHint,
  cloudflareSendingErrorHint,
} from "./cloudflare-api-hints";
import { buildMimeMessage } from "./mime";

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

export type CfEmailSendResult = {
  messageId: string;
  delivered: string[];
  permanentBounces: string[];
  queued: string[];
};

export type CfEmailRoutingSettings = {
  enabled: boolean;
};

export type CfEmailRoutingAction = {
  type: "forward" | "drop" | "worker";
  value?: string[];
};

export type CfEmailRoutingMatcher = {
  type: "literal" | "all";
  field?: "to";
  value?: string;
};

export type CfEmailRoutingRule = {
  id: string;
  enabled: boolean;
  matchers: CfEmailRoutingMatcher[];
  actions: CfEmailRoutingAction[];
};

export type CloudflareClientCredentials = {
  accountId: string;
  apiToken: string;
};

export class CloudflareClient {
  private accountId: string;
  private apiToken: string;

  constructor(credentials: CloudflareClientCredentials) {
    this.accountId = credentials.accountId;
    this.apiToken = credentials.apiToken;
  }

  private tokenHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiToken}`,
      "Content-Type": "application/json",
    };
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async requestOnce<T>(
    path: string,
    init: RequestInit | undefined,
  ): Promise<{ res: Response; data: CfResponse<T> }> {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { ...this.tokenHeaders(), ...init?.headers },
    });
    const raw = (await res.json()) as CfLooseErrorBody;
    const data = normalizeCfResponse<T>(raw);
    return { res, data };
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

    const isAuthError =
      res.status === 401 ||
      res.status === 403 ||
      data.errors?.some(
        (e) =>
          e.code === 10000 ||
          e.code === 10101 ||
          e.code === 10102 ||
          e.code === 10103 ||
          e.message?.toLowerCase().includes("authentication") ||
          e.message?.toLowerCase().includes("unauthorized"),
      );

    const lines = [`Cloudflare API: ${details}`, `API: ${(method ?? "GET").toUpperCase()} ${path}`];

    if (isAuthError) {
      const hint = cloudflarePermissionHint(path, method ?? "GET");
      if (hint) lines.push("", hint);
    } else {
      const sendingHint = cloudflareSendingErrorHint(data.errors);
      if (sendingHint) lines.push("", sendingHint);
    }

    return new Error(lines.join("\n"));
  }

  private async request<T>(
    path: string,
    init?: RequestInit,
  ): Promise<CfResponse<T>> {
    const { res, data } = await this.requestOnce<T>(path, init);
    if (res.ok && data.success) return data;
    throw this.formatCfError(res, data, path, init?.method ?? "GET");
  }

  private async sendWithRetry<T>(
    path: string,
    init: RequestInit,
  ): Promise<CfResponse<T>> {
    const maxAttempts = 3;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        return await this.request<T>(path, init);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const retryable =
          lastError.message.includes("[10002]") ||
          lastError.message.includes("[10100]");
        if (!retryable || attempt === maxAttempts - 1) throw lastError;
        await this.sleep(1500 * (attempt + 1));
      }
    }

    throw lastError ?? new Error("Cloudflare Email Sending request failed");
  }

  private mapSendResult(data: CfResponse<{
    message_id: string;
    delivered: string[];
    permanent_bounces: string[];
    queued: string[];
  }>): CfEmailSendResult {
    return {
      messageId:
        data.result.message_id ??
        `cf-${data.result.delivered?.[0] ?? data.result.queued?.[0] ?? "sent"}-${Date.now()}`,
      delivered: data.result.delivered ?? [],
      permanentBounces: data.result.permanent_bounces ?? [],
      queued: data.result.queued ?? [],
    };
  }

  private async sendStructuredEmail(params: {
    from: string;
    fromName?: string;
    to: string | string[];
    cc?: string | string[];
    subject: string;
    text: string;
    html?: string;
    replyTo?: string;
  }): Promise<CfEmailSendResult> {
    const fromAddress = params.from.trim();
    const fromName = params.fromName?.trim();
    const body: Record<string, unknown> = {
      from: fromName
        ? { address: fromAddress, name: fromName }
        : fromAddress,
      to: params.to,
      subject: params.subject,
      text: params.text,
    };
    if (params.cc) body.cc = params.cc;
    const html = params.html?.trim();
    if (html) body.html = html;
    const replyTo = params.replyTo?.trim();
    if (replyTo) body.reply_to = replyTo;

    const path = `/accounts/${this.accountId}/email/sending/send`;
    const data = await this.sendWithRetry<{
      message_id: string;
      delivered: string[];
      permanent_bounces: string[];
      queued: string[];
    }>(path, {
      method: "POST",
      body: JSON.stringify(body),
    });
    return this.mapSendResult(data);
  }

  private async sendRawEmail(params: {
    from: string;
    fromName?: string;
    to: string | string[];
    cc?: string | string[];
    subject: string;
    text: string;
    html?: string;
    replyTo?: string;
  }): Promise<CfEmailSendResult> {
    const fromAddress = params.from.trim();
    const toList = Array.isArray(params.to) ? params.to : [params.to];
    const ccList = params.cc
      ? Array.isArray(params.cc)
        ? params.cc
        : [params.cc]
      : [];
    const recipients = [...toList, ...ccList]
      .map((address) => address.trim())
      .filter(Boolean);
    const mimeMessage = buildMimeMessage({
      from: fromAddress,
      fromName: params.fromName,
      to: params.to,
      cc: params.cc,
      subject: params.subject,
      text: params.text,
      html: params.html,
      replyTo: params.replyTo,
    });

    const path = `/accounts/${this.accountId}/email/sending/send_raw`;
    const data = await this.sendWithRetry<{
      message_id: string;
      delivered: string[];
      permanent_bounces: string[];
      queued: string[];
    }>(path, {
      method: "POST",
      body: JSON.stringify({
        from: fromAddress,
        recipients,
        mime_message: mimeMessage,
      }),
    });
    return this.mapSendResult(data);
  }

  async sendEmail(params: {
    from: string;
    fromName?: string;
    to: string | string[];
    cc?: string | string[];
    subject: string;
    text: string;
    html?: string;
    replyTo?: string;
  }): Promise<CfEmailSendResult> {
    const fromName = params.fromName?.trim();
    if (fromName) {
      return this.sendRawEmail({ ...params, fromName });
    }
    return this.sendStructuredEmail(params);
  }

  async resolveZoneId(domain: string): Promise<string | null> {
    const data = await this.request<Array<{ id: string; name: string }>>(
      `/zones?name=${encodeURIComponent(domain.trim())}`,
    );
    const zone = data.result?.find(
      (item) => item.name.toLowerCase() === domain.trim().toLowerCase(),
    );
    return zone?.id ?? data.result?.[0]?.id ?? null;
  }

  async getEmailRoutingSettings(zoneId: string): Promise<CfEmailRoutingSettings> {
    const data = await this.request<{ enabled: boolean }>(
      `/zones/${zoneId}/email/routing`,
    );
    return { enabled: Boolean(data.result?.enabled) };
  }

  async enableEmailRouting(zoneId: string): Promise<CfEmailRoutingSettings> {
    const data = await this.request<{ enabled: boolean }>(
      `/zones/${zoneId}/email/routing/enable`,
      { method: "POST" },
    );
    return { enabled: Boolean(data.result?.enabled) };
  }

  async listEmailRoutingRules(zoneId: string): Promise<CfEmailRoutingRule[]> {
    const data = await this.request<CfEmailRoutingRule[]>(
      `/zones/${zoneId}/email/routing/rules`,
    );
    return data.result ?? [];
  }

  async createEmailRoutingRule(
    zoneId: string,
    rule: {
      name?: string;
      enabled?: boolean;
      priority?: number;
      actions: CfEmailRoutingAction[];
      matchers: CfEmailRoutingMatcher[];
    },
  ): Promise<CfEmailRoutingRule> {
    const data = await this.request<CfEmailRoutingRule>(
      `/zones/${zoneId}/email/routing/rules`,
      {
        method: "POST",
        body: JSON.stringify(rule),
      },
    );
    return data.result;
  }

  async updateEmailRoutingRule(
    zoneId: string,
    ruleId: string,
    rule: {
      name?: string;
      enabled?: boolean;
      priority?: number;
      actions?: CfEmailRoutingAction[];
      matchers?: CfEmailRoutingMatcher[];
    },
  ): Promise<CfEmailRoutingRule> {
    const data = await this.request<CfEmailRoutingRule>(
      `/zones/${zoneId}/email/routing/rules/${ruleId}`,
      {
        method: "PUT",
        body: JSON.stringify(rule),
      },
    );
    return data.result;
  }
}
