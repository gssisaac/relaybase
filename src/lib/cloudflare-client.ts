import {
  cloudflarePermissionHint,
  cloudflareSendingErrorHint,
} from "./cloudflare-api-hints";

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

  async sendEmail(params: {
    from: string;
    fromName?: string;
    to: string;
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
      to: params.to.trim(),
      subject: params.subject,
      text: params.text,
    };
    const html = params.html?.trim();
    if (html) body.html = html;
    const replyTo = params.replyTo?.trim();
    if (replyTo) body.reply_to = replyTo;

    const path = `/accounts/${this.accountId}/email/sending/send`;
    const maxAttempts = 3;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const data = await this.request<{
          message_id: string;
          delivered: string[];
          permanent_bounces: string[];
          queued: string[];
        }>(path, {
          method: "POST",
          body: JSON.stringify(body),
        });
        return {
          messageId:
            data.result.message_id ??
            `cf-${data.result.delivered?.[0] ?? data.result.queued?.[0] ?? "sent"}-${Date.now()}`,
          delivered: data.result.delivered ?? [],
          permanentBounces: data.result.permanent_bounces ?? [],
          queued: data.result.queued ?? [],
        };
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
}
