import {
  cloudflarePermissionHint,
  cloudflareSendingErrorHint,
} from "@/lib/cloudflare/api-hints";

const API_BASE = "https://api.cloudflare.com/client/v4";

type CfResponse<T> = {
  success: boolean;
  errors?: Array<{ code?: number; message: string }>;
  result: T;
  result_info?: {
    page?: number;
    per_page?: number;
    total_count?: number;
  };
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

export type CfPagesProject = {
  id: string;
  name: string;
  subdomain: string;
  canonical_deployment?: CfPagesDeployment | null;
  latest_deployment?: CfPagesDeployment | null;
  production_branch?: string;
  build_config?: {
    build_command?: string;
    destination_dir?: string;
    root_dir?: string;
    build_caching?: boolean;
  };
  source?: {
    type: string;
    config?: {
      owner?: string;
      repo_name?: string;
      production_branch?: string;
      pr_comments_enabled?: boolean;
      deployments_enabled?: boolean;
      production_deployments_enabled?: boolean;
      preview_deployment_setting?: string;
    };
  };
  created_on?: string;
  domains?: string[];
};

export type CfPagesDeployment = {
  id: string;
  url: string;
  environment: string;
  created_on: string;
  modified_on?: string;
  latest_stage?: {
    name: string;
    status: string;
    started_on?: string;
    ended_on?: string;
  };
  deployment_trigger?: {
    type: string;
    metadata?: {
      branch?: string;
      commit_hash?: string;
      commit_message?: string;
      commit_dirty?: boolean;
    };
  };
  stages?: Array<{
    name: string;
    status: string;
    started_on?: string;
    ended_on?: string;
  }>;
};

export type CfPagesDomain = {
  id: string;
  name: string;
  status: string;
  verification_data?: {
    status?: string;
  };
  validation_data?: {
    status?: string;
  };
  certificate_authority?: string;
  zone_id?: string;
};

export type CfWorkerDomain = {
  id: string;
  hostname: string;
  service: string;
  zone_id: string;
  environment?: string;
};

export type CfDnsRecord = {
  id: string;
  type: string;
  name: string;
  content: string;
  proxied: boolean;
  ttl: number;
};

export type CfEmailRoutingSettings = {
  id: string;
  enabled: boolean;
  name: string;
  status?: "ready" | "unconfigured" | "misconfigured" | "misconfigured/locked" | "unlocked";
  created?: string;
  modified?: string;
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
  tag?: string;
  name?: string;
  enabled: boolean;
  priority?: number;
  actions: CfEmailRoutingAction[];
  matchers: CfEmailRoutingMatcher[];
};

export type CfEmailDestinationAddress = {
  id: string;
  email: string;
  verified: string | null;
  created?: string;
  modified?: string;
};

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

export type CfEmailSendResult = {
  messageId: string;
  delivered: string[];
  permanentBounces: string[];
  queued: string[];
};

export type CfEmailActivityEvent = {
  datetime: string;
  from: string;
  to: string;
  subject: string;
  status: string;
  messageId: string;
  action?: string;
  errorDetail?: string;
  eventType?: string;
};

export type CfAnalyticsDay = {
  date: string;
  requests: number;
  pageViews: number;
  uniques: number;
};

export type CfWorkerDeployment = {
  id: string;
  source: string;
  created_on: string;
  author_email?: string;
  annotations?: Record<string, string>;
  versions: Array<{ version_id: string; percentage: number }>;
};

export type CfWorkerVersion = {
  id: string;
  number: number;
  metadata: {
    created_on: string;
    source: string;
    author_email?: string;
  };
  annotations?: Record<string, string>;
};

export type CfRegistrarRegistration = {
  domain_name: string;
  auto_renew: boolean;
  expires_at: string | null;
  status: string;
  created_at?: string;
  locked?: boolean;
  privacy_mode?: string;
};

export type CloudflareClientCredentials = {
  accountId: string;
  apiToken: string;
  /** Optional token used only for /dns_records (falls back to apiToken). */
  dnsApiToken?: string;
  /** Legacy Global API Key + account email — required for DNS when apiToken is Workers-only. */
  apiEmail?: string;
  globalApiKey?: string;
};

export class CloudflareClient {
  private accountId: string;
  private apiToken: string;
  private dnsApiToken: string;
  private apiEmail: string;
  private globalApiKey: string;

  private constructor(credentials: CloudflareClientCredentials) {
    this.accountId = credentials.accountId;
    this.apiToken = credentials.apiToken;
    this.dnsApiToken = credentials.dnsApiToken?.trim() || credentials.apiToken;
    this.apiEmail = credentials.apiEmail?.trim() ?? "";
    this.globalApiKey = credentials.globalApiKey?.trim() ?? "";
  }

  static create(credentials: CloudflareClientCredentials): CloudflareClient {
    return new CloudflareClient(credentials);
  }

  private tokenHeaders(token: string): Record<string, string> {
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  }

  private globalKeyHeaders(): Record<string, string> | null {
    if (!this.apiEmail || !this.globalApiKey) return null;
    return {
      "X-Auth-Email": this.apiEmail,
      "X-Auth-Key": this.globalApiKey,
      "Content-Type": "application/json",
    };
  }

  private isDnsPath(path: string): boolean {
    return path.includes("/dns_records");
  }

  private isRateLimited(res: Response, data: CfResponse<unknown>): boolean {
    if (res.status === 429) return true;
    return data.errors?.some((e) => e.code === 10429) ?? false;
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async requestOnce<T>(
    path: string,
    init: RequestInit | undefined,
    headers: Record<string, string>,
  ): Promise<{ res: Response; data: CfResponse<T> }> {
    const maxAttempts = 4;
    let last: { res: Response; data: CfResponse<T> } | null = null;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const res = await fetch(`${API_BASE}${path}`, {
        ...init,
        headers: { ...headers, ...init?.headers },
      });
      const raw = (await res.json()) as CfLooseErrorBody;
      const data = normalizeCfResponse<T>(raw);
      last = { res, data };

      if (!this.isRateLimited(res, data) || attempt === maxAttempts - 1) {
        return last;
      }

      const retryAfterSec = Number(res.headers.get("retry-after"));
      const delayMs = Number.isFinite(retryAfterSec) && retryAfterSec > 0
        ? retryAfterSec * 1000
        : 1500 * 2 ** attempt;
      await this.sleep(delayMs);
    }

    return last!;
  }

  private formatCfError(
    res: Response,
    data: CfResponse<unknown>,
    context: string,
    path?: string,
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
          e.code === 2036 ||
          e.code === 10101 ||
          e.code === 10102 ||
          e.code === 10103 ||
          e.message?.toLowerCase().includes("authentication") ||
          e.message?.toLowerCase().includes("unauthorized"),
      );

    const lines = [`Cloudflare API (${context}): ${details}`];

    if (path) {
      lines.push(`API: ${(method ?? "GET").toUpperCase()} ${path}`);
    }

    if (isAuthError) {
      const hint = path ? cloudflarePermissionHint(path, method ?? "GET") : null;
      if (hint) {
        lines.push("", hint);
      } else {
        lines.push(
          "",
          "API token is valid but missing permission for this endpoint.",
          "Check the API token for this surface: MacPurity → Website settings (Pages/Workers) or Email → Settings (Email Sending/Routing).",
        );
      }
    } else {
      const sendingHint = cloudflareSendingErrorHint(data.errors);
      if (sendingHint) {
        lines.push("", sendingHint);
      }
    }

    return new Error(lines.join("\n"));
  }

  private async request<T>(
    path: string,
    init?: RequestInit,
  ): Promise<CfResponse<T>> {
    const headers = this.tokenHeaders(this.apiToken);
    const { res, data } = await this.requestOnce<T>(path, init, headers);
    if (res.ok && data.success) return data;
    throw this.formatCfError(res, data, "API", path, init?.method ?? "GET");
  }

  private async requestDns<T>(
    path: string,
    init?: RequestInit,
  ): Promise<CfResponse<T>> {
    const attempts: Array<{ label: string; headers: Record<string, string> }> =
      [];
    attempts.push({
      label: "DNS API token",
      headers: this.tokenHeaders(this.dnsApiToken),
    });
    const globalHeaders = this.globalKeyHeaders();
    if (globalHeaders) {
      attempts.push({ label: "Global API Key", headers: globalHeaders });
    }
    if (
      this.dnsApiToken !== this.apiToken &&
      !attempts.some((a) => a.headers.Authorization?.includes(this.apiToken))
    ) {
      attempts.push({
        label: "Website API token",
        headers: this.tokenHeaders(this.apiToken),
      });
    }

    let lastError: Error | null = null;
    for (const attempt of attempts) {
      const { res, data } = await this.requestOnce<T>(path, init, attempt.headers);
      if (res.ok && data.success) return data;
      lastError = this.formatCfError(res, data, attempt.label, path, init?.method ?? "GET");
      const authFail =
        res.status === 403 ||
        data.errors?.some(
          (e) =>
            e.code === 10000 ||
            e.message?.toLowerCase().includes("authentication"),
        );
      if (!authFail) throw lastError;
    }
    throw lastError ?? new Error("Cloudflare DNS API request failed");
  }

  /** Returns which auth method succeeded for DNS list. */
  async probeDnsAccess(
    zoneId: string,
  ): Promise<"dns_token" | "global_api_key"> {
    const path = `/zones/${zoneId}/dns_records?per_page=1`;
    const attempts: Array<{
      label: "dns_token" | "global_api_key";
      headers: Record<string, string>;
    }> = [
      {
        label: "dns_token",
        headers: this.tokenHeaders(this.dnsApiToken),
      },
    ];
    const globalHeaders = this.globalKeyHeaders();
    if (globalHeaders) {
      attempts.push({ label: "global_api_key", headers: globalHeaders });
    }

    let lastError: Error | null = null;
    for (const attempt of attempts) {
      const { res, data } = await this.requestOnce(path, undefined, attempt.headers);
      if (res.ok && data.success) return attempt.label;
      lastError = this.formatCfError(res, data, attempt.label, path, "GET");
    }
    throw lastError ?? new Error("Cloudflare DNS probe failed");
  }

  private async requestForPath<T>(
    path: string,
    init?: RequestInit,
  ): Promise<CfResponse<T>> {
    if (this.isDnsPath(path)) return this.requestDns(path, init);
    return this.request(path, init);
  }

  async getPagesProject(projectName: string): Promise<CfPagesProject> {
    const data = await this.request<CfPagesProject>(
      `/accounts/${this.accountId}/pages/projects/${projectName}`,
    );
    return data.result;
  }

  async updatePagesProjectBuildConfig(
    projectName: string,
    buildConfig: {
      rootDir?: string;
      buildCommand?: string;
      destinationDir?: string;
    },
  ): Promise<CfPagesProject> {
    const build_config: Record<string, string> = {};
    if (buildConfig.rootDir !== undefined) {
      build_config.root_dir = buildConfig.rootDir;
    }
    if (buildConfig.buildCommand !== undefined) {
      build_config.build_command = buildConfig.buildCommand;
    }
    if (buildConfig.destinationDir !== undefined) {
      build_config.destination_dir = buildConfig.destinationDir;
    }

    const data = await this.request<CfPagesProject>(
      `/accounts/${this.accountId}/pages/projects/${projectName}`,
      {
        method: "PATCH",
        body: JSON.stringify({ build_config }),
      },
    );
    return data.result;
  }

  async listPagesProjects(): Promise<CfPagesProject[]> {
    const data = await this.request<CfPagesProject[]>(
      `/accounts/${this.accountId}/pages/projects`,
    );
    return data.result ?? [];
  }

  async createPagesProject(
    name: string,
    productionBranch = "main",
    github?: { owner: string; repo: string },
  ): Promise<CfPagesProject> {
    const branch = productionBranch.trim() || "main";
    const body: Record<string, unknown> = {
      name,
      production_branch: branch,
    };
    if (github) {
      body.source = {
        type: "github",
        config: {
          owner: github.owner.trim(),
          repo_name: github.repo.trim(),
          production_branch: branch,
          deployments_enabled: true,
          production_deployments_enabled: true,
        },
      };
    }
    const data = await this.request<CfPagesProject>(
      `/accounts/${this.accountId}/pages/projects`,
      {
        method: "POST",
        body: JSON.stringify(body),
      },
    );
    return data.result;
  }

  async connectPagesProjectGithub(
    projectName: string,
    input: { owner: string; repo: string; productionBranch?: string },
  ): Promise<CfPagesProject> {
    const branch = input.productionBranch?.trim() || "main";
    const data = await this.request<CfPagesProject>(
      `/accounts/${this.accountId}/pages/projects/${projectName}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          production_branch: branch,
          source: {
            type: "github",
            config: {
              owner: input.owner.trim(),
              repo_name: input.repo.trim(),
              production_branch: branch,
              deployments_enabled: true,
              production_deployments_enabled: true,
            },
          },
        }),
      },
    );
    return data.result;
  }

  pagesProjectGithubConnected(
    project: CfPagesProject,
    owner: string,
    repo: string,
  ): boolean {
    const source = project.source;
    return (
      source?.type === "github" &&
      source.config?.owner === owner.trim() &&
      source.config?.repo_name === repo.trim()
    );
  }

  /** Direct Upload projects cannot be converted to Git after creation. */
  isPagesDirectUploadProject(project: CfPagesProject): boolean {
    const type = project.source?.type?.toLowerCase();
    return !type || (type !== "github" && type !== "gitlab");
  }

  async deletePagesProject(projectName: string): Promise<void> {
    await this.request<null>(
      `/accounts/${this.accountId}/pages/projects/${projectName}`,
      { method: "DELETE" },
    );
  }

  /** Verify account + token by listing worker scripts. */
  async verifyAccountAccess(): Promise<void> {
    await this.listWorkerScripts();
  }

  async listDeployments(
    projectName: string,
    page = 1,
    perPage = 10,
  ): Promise<CfPagesDeployment[]> {
    const data = await this.request<CfPagesDeployment[]>(
      `/accounts/${this.accountId}/pages/projects/${projectName}/deployments?page=${page}&per_page=${perPage}`,
    );
    return data.result ?? [];
  }

  async triggerDeployment(
    projectName: string,
    branch: string,
  ): Promise<CfPagesDeployment> {
    const data = await this.request<CfPagesDeployment>(
      `/accounts/${this.accountId}/pages/projects/${projectName}/deployments`,
      {
        method: "POST",
        body: JSON.stringify({ branch }),
      },
    );
    return data.result;
  }

  async listProjectDomains(projectName: string): Promise<CfPagesDomain[]> {
    const data = await this.request<CfPagesDomain[]>(
      `/accounts/${this.accountId}/pages/projects/${projectName}/domains`,
    );
    return data.result ?? [];
  }

  async addPagesProjectDomain(
    projectName: string,
    domainName: string,
  ): Promise<CfPagesDomain> {
    const data = await this.request<CfPagesDomain>(
      `/accounts/${this.accountId}/pages/projects/${projectName}/domains`,
      {
        method: "POST",
        body: JSON.stringify({ name: domainName }),
      },
    );
    return data.result;
  }

  async listWorkerDomains(): Promise<CfWorkerDomain[]> {
    const data = await this.request<CfWorkerDomain[]>(
      `/accounts/${this.accountId}/workers/domains`,
    );
    return data.result ?? [];
  }

  async attachWorkerCustomDomain(input: {
    hostname: string;
    zoneId: string;
    service: string;
  }): Promise<CfWorkerDomain> {
    const data = await this.request<CfWorkerDomain>(
      `/accounts/${this.accountId}/workers/domains`,
      {
        method: "PUT",
        body: JSON.stringify({
          hostname: input.hostname,
          zone_id: input.zoneId,
          service: input.service,
        }),
      },
    );
    return data.result;
  }

  async listWorkerSecrets(scriptName: string): Promise<Array<{ name: string }>> {
    const data = await this.request<Array<{ name: string; type?: string }>>(
      `/accounts/${this.accountId}/workers/scripts/${scriptName}/secrets`,
    );
    return (data.result ?? []).map((s) => ({ name: s.name }));
  }

  async listWorkerScripts(): Promise<Array<{ id: string }>> {
    const data = await this.request<Array<{ id: string }>>(
      `/accounts/${this.accountId}/workers/scripts`,
    );
    return data.result ?? [];
  }

  async getWorkerDeployments(scriptName: string): Promise<CfWorkerDeployment[]> {
    const data = await this.request<{ deployments: CfWorkerDeployment[] }>(
      `/accounts/${this.accountId}/workers/scripts/${scriptName}/deployments`,
    );
    return data.result?.deployments ?? [];
  }

  /** Daily Worker invocations for charting (GraphQL; may fail if token lacks Analytics). */
  async fetchWorkerDailyMetrics(
    scriptName: string,
    days = 30,
  ): Promise<Array<{ date: string; requests: number; errors: number }>> {
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - days);

    const query = `
      query WorkerDailyMetrics($accountId: String!, $scriptName: String!, $since: Time!) {
        viewer {
          accounts(filter: { accountTag: $accountId }) {
            workersInvocationsAdaptive(
              limit: 10000
              filter: { datetime_geq: $since, scriptName: $scriptName }
              orderBy: [datetime_ASC]
            ) {
              dimensions { datetime }
              sum { requests errors }
            }
          }
        }
      }
    `;

    try {
      const res = await fetch(`${API_BASE}/graphql`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query,
          variables: {
            accountId: this.accountId,
            scriptName,
            since: since.toISOString(),
          },
        }),
      });

      const payload = (await res.json()) as {
        errors?: Array<{ message: string }>;
        data?: {
          viewer?: {
            accounts?: Array<{
              workersInvocationsAdaptive?: Array<{
                dimensions?: { datetime?: string };
                sum?: { requests?: number; errors?: number };
              }>;
            }>;
          };
        };
      };

      if (!res.ok || payload.errors?.length) return [];

      const groups =
        payload.data?.viewer?.accounts?.[0]?.workersInvocationsAdaptive ?? [];

      const byDate = new Map<string, { requests: number; errors: number }>();
      for (const g of groups) {
        const dt = g.dimensions?.datetime;
        if (!dt) continue;
        const date = dt.slice(0, 10);
        const prev = byDate.get(date) ?? { requests: 0, errors: 0 };
        byDate.set(date, {
          requests: prev.requests + (g.sum?.requests ?? 0),
          errors: prev.errors + (g.sum?.errors ?? 0),
        });
      }

      const series: Array<{ date: string; requests: number; errors: number }> =
        [];
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setUTCDate(d.getUTCDate() - i);
        const date = d.toISOString().slice(0, 10);
        const row = byDate.get(date);
        series.push({
          date,
          requests: row?.requests ?? 0,
          errors: row?.errors ?? 0,
        });
      }
      return series;
    } catch {
      return [];
    }
  }

  /** Sum Worker invocations + errors for the last N days (GraphQL; may fail if token lacks Analytics). */
  async fetchWorkerMetrics(
    scriptName: string,
    days = 7,
  ): Promise<{ requests: number; errors: number } | null> {
    const series = await this.fetchWorkerDailyMetrics(scriptName, days);
    if (series.length === 0) return null;
    let requests = 0;
    let errors = 0;
    for (const day of series) {
      requests += day.requests;
      errors += day.errors;
    }
    return { requests, errors };
  }

  async workerScriptExists(scriptName: string): Promise<boolean> {
    const scripts = await this.listWorkerScripts();
    return scripts.some((s) => s.id === scriptName);
  }

  /** Upload a minimal module-syntax Worker (creates the script if it does not exist). */
  async createWorkerScript(scriptName: string): Promise<{ id: string }> {
    const scriptCode = `export default {
  async fetch() {
    return new Response("Deployed from ops dashboard wizard", {
      headers: { "content-type": "text/plain" },
    });
  },
};`;

    const metadata = JSON.stringify({
      main_module: "worker.js",
      compatibility_date: new Date().toISOString().slice(0, 10),
    });

    const form = new FormData();
    form.append(
      "worker.js",
      new Blob([scriptCode], { type: "application/javascript+module" }),
      "worker.js",
    );
    form.append("metadata", metadata);

    const path = `/accounts/${this.accountId}/workers/scripts/${encodeURIComponent(scriptName)}`;
    const { res, data } = await this.requestOnce<{ id: string }>(path, {
      method: "PUT",
      body: form,
    }, {
      Authorization: `Bearer ${this.apiToken}`,
    });

    if (res.ok && data.success) {
      return { id: data.result?.id ?? scriptName };
    }
    throw this.formatCfError(res, data, "API", path, "PUT");
  }

  async workersDevHostname(scriptName: string): Promise<string> {
    const subdomain = await this.getWorkersAccountSubdomain();
    if (subdomain) {
      return `${scriptName}.${subdomain}.workers.dev`;
    }
    return `${scriptName}.workers.dev`;
  }

  async listWorkerVersions(scriptName: string): Promise<CfWorkerVersion[]> {
    const data = await this.request<{ items: CfWorkerVersion[] }>(
      `/accounts/${this.accountId}/workers/scripts/${scriptName}/versions`,
    );
    return data.result?.items ?? [];
  }

  async getWorkersAccountSubdomain(): Promise<string | null> {
    const data = await this.request<{ subdomain: string }>(
      `/accounts/${this.accountId}/workers/subdomain`,
    );
    return data.result?.subdomain ?? null;
  }

  async resolveZoneId(domain: string): Promise<string | null> {
    const data = await this.request<Array<{ id: string; name: string }>>(
      `/zones?name=${encodeURIComponent(domain)}`,
    );
    return data.result?.[0]?.id ?? null;
  }

  async listDnsRecords(zoneId: string, perPage = 100): Promise<CfDnsRecord[]> {
    const data = await this.requestForPath<CfDnsRecord[]>(
      `/zones/${zoneId}/dns_records?per_page=${perPage}`,
    );
    return data.result ?? [];
  }

  async createDnsRecord(
    zoneId: string,
    record: {
      type: string;
      name: string;
      content: string;
      proxied?: boolean;
      priority?: number;
      ttl?: number;
    },
  ): Promise<CfDnsRecord> {
    const data = await this.requestForPath<CfDnsRecord>(
      `/zones/${zoneId}/dns_records`,
      {
        method: "POST",
        body: JSON.stringify({
          type: record.type,
          name: record.name,
          content: record.content,
          proxied: record.proxied ?? false,
          priority: record.priority,
          ttl: record.ttl ?? 1,
        }),
      },
    );
    return data.result;
  }

  async updateDnsRecord(
    zoneId: string,
    recordId: string,
    record: {
      type: string;
      name: string;
      content: string;
      proxied?: boolean;
      priority?: number;
      ttl?: number;
    },
  ): Promise<CfDnsRecord> {
    const data = await this.requestForPath<CfDnsRecord>(
      `/zones/${zoneId}/dns_records/${recordId}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          type: record.type,
          name: record.name,
          content: record.content,
          proxied: record.proxied ?? false,
          priority: record.priority,
          ttl: record.ttl ?? 1,
        }),
      },
    );
    return data.result;
  }

  /** Match by type + normalized name; update if found, else create. */
  async upsertDnsRecord(
    zoneId: string,
    record: {
      type: string;
      name: string;
      content: string;
      proxied?: boolean;
      priority?: number;
      ttl?: number;
    },
  ): Promise<CfDnsRecord> {
    const records = await this.listDnsRecords(zoneId, 200);
    const targetName = record.name.toLowerCase();
    const existing = records.find(
      (r) =>
        r.type === record.type &&
        r.name.toLowerCase() === targetName,
    );
    if (existing) {
      return this.updateDnsRecord(zoneId, existing.id, record);
    }
    return this.createDnsRecord(zoneId, record);
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

  async disableEmailRouting(zoneId: string): Promise<CfEmailRoutingSettings> {
    const data = await this.request<CfEmailRoutingSettings>(
      `/zones/${zoneId}/email/routing/disable`,
      { method: "POST", body: "{}" },
    );
    return data.result;
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

  async deleteEmailRoutingRule(zoneId: string, ruleId: string): Promise<void> {
    await this.request<null>(
      `/zones/${zoneId}/email/routing/rules/${ruleId}`,
      { method: "DELETE" },
    );
  }

  async listDestinationAddresses(): Promise<CfEmailDestinationAddress[]> {
    const data = await this.request<CfEmailDestinationAddress[]>(
      `/accounts/${this.accountId}/email/routing/addresses?per_page=100`,
    );
    return data.result ?? [];
  }

  async createDestinationAddress(
    email: string,
  ): Promise<CfEmailDestinationAddress> {
    const data = await this.request<CfEmailDestinationAddress>(
      `/accounts/${this.accountId}/email/routing/addresses`,
      {
        method: "POST",
        body: JSON.stringify({ email }),
      },
    );
    return data.result;
  }

  async deleteDestinationAddress(addressId: string): Promise<void> {
    await this.request<null>(
      `/accounts/${this.accountId}/email/routing/addresses/${addressId}`,
      { method: "DELETE" },
    );
  }

  async sendEmail(params: {
    from: string;
    to: string;
    subject: string;
    text: string;
    html?: string;
    replyTo?: string;
  }): Promise<CfEmailSendResult> {
    const body: Record<string, string> = {
      from: params.from.trim(),
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
    const subdomain = normalizeSendingSubdomain(data.result);
    return subdomain;
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

  async fetchEmailRoutingActivity(
    zoneId: string,
    limit = 50,
  ): Promise<CfEmailActivityEvent[]> {
    const end = new Date();
    const start = new Date();
    start.setUTCDate(start.getUTCDate() - 7);

    const query = `
      query EmailRoutingEvents($zoneTag: string!, $start: Time!, $end: Time!) {
        viewer {
          zones(filter: { zoneTag: $zoneTag }) {
            emailRoutingAdaptive(
              filter: { datetime_geq: $start, datetime_leq: $end }
              limit: ${limit}
              orderBy: [datetime_DESC]
            ) {
              datetime
              from
              to
              subject
              status
              messageId
              action
              errorDetail
              eventType
            }
          }
        }
      }
    `;

    return this.graphqlEmailEvents(query, {
      zoneTag: zoneId,
      start: start.toISOString(),
      end: end.toISOString(),
    });
  }

  async fetchEmailSendingActivity(
    zoneId: string,
    limit = 50,
  ): Promise<CfEmailActivityEvent[]> {
    const end = new Date();
    const start = new Date();
    start.setUTCDate(start.getUTCDate() - 7);

    const query = `
      query EmailSendingEvents($zoneTag: string!, $start: Time!, $end: Time!) {
        viewer {
          zones(filter: { zoneTag: $zoneTag }) {
            emailSendingAdaptive(
              filter: { datetime_geq: $start, datetime_leq: $end }
              limit: ${limit}
              orderBy: [datetime_DESC]
            ) {
              datetime
              from
              to
              subject
              status
              messageId
              errorDetail
              eventType
            }
          }
        }
      }
    `;

    return this.graphqlEmailEvents(query, {
      zoneTag: zoneId,
      start: start.toISOString(),
      end: end.toISOString(),
    });
  }

  private async graphqlEmailEvents(
    query: string,
    variables: Record<string, string>,
  ): Promise<CfEmailActivityEvent[]> {
    const res = await fetch(`${API_BASE}/graphql`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, variables }),
    });

    const payload = (await res.json()) as {
      errors?: Array<{ message: string }>;
      data?: {
        viewer?: {
          zones?: Array<{
            emailRoutingAdaptive?: Array<Record<string, string>>;
            emailSendingAdaptive?: Array<Record<string, string>>;
          }>;
        };
      };
    };

    if (!res.ok || payload.errors?.length) {
      const msg =
        payload.errors?.map((e) => e.message).join("; ") ||
        `Cloudflare GraphQL error (${res.status})`;
      throw new Error(msg);
    }

    const zone = payload.data?.viewer?.zones?.[0];
    const rows =
      zone?.emailRoutingAdaptive ?? zone?.emailSendingAdaptive ?? [];

    return rows.map((row) => ({
      datetime: row.datetime ?? "",
      from: row.from ?? "",
      to: row.to ?? "",
      subject: row.subject ?? "",
      status: row.status ?? "",
      messageId: row.messageId ?? "",
      action: row.action,
      errorDetail: row.errorDetail,
      eventType: row.eventType,
    }));
  }

  async verifyEmailServiceAccess(): Promise<void> {
    await this.listDestinationAddresses();
  }

  async fetchVisitorAnalytics(
    zoneId: string,
    days = 7,
  ): Promise<CfAnalyticsDay[]> {
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - days);
    const sinceStr = since.toISOString().slice(0, 10);

    const query = `
      query ZoneAnalytics($zoneTag: string!, $since: Time!) {
        viewer {
          zones(filter: { zoneTag: $zoneTag }) {
            httpRequests1dGroups(
              limit: ${days + 1}
              filter: { date_geq: $since }
              orderBy: [date_ASC]
            ) {
              dimensions { date }
              sum { requests pageViews uniques }
            }
          }
        }
      }
    `;

    const res = await fetch(`${API_BASE}/graphql`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        variables: { zoneTag: zoneId, since: sinceStr },
      }),
    });

    const payload = (await res.json()) as {
      errors?: Array<{ message: string }>;
      data?: {
        viewer?: {
          zones?: Array<{
            httpRequests1dGroups?: Array<{
              dimensions: { date: string };
              sum: {
                requests: number;
                pageViews: number;
                uniques: number;
              };
            }>;
          }>;
        };
      };
    };

    if (!res.ok || payload.errors?.length) {
      const msg =
        payload.errors?.map((e) => e.message).join("; ") ||
        `Cloudflare GraphQL error (${res.status})`;
      throw new Error(msg);
    }

    const groups =
      payload.data?.viewer?.zones?.[0]?.httpRequests1dGroups ?? [];

    return groups.map((g) => ({
      date: g.dimensions.date,
      requests: g.sum.requests ?? 0,
      pageViews: g.sum.pageViews ?? 0,
      uniques: g.sum.uniques ?? 0,
    }));
  }

  async listRegistrarRegistrations(): Promise<CfRegistrarRegistration[]> {
    const all: CfRegistrarRegistration[] = [];
    let cursor: string | undefined;

    for (;;) {
      const query = cursor
        ? `?cursor=${encodeURIComponent(cursor)}`
        : "";
      const data = await this.request<CfRegistrarRegistration[]>(
        `/accounts/${this.accountId}/registrar/registrations${query}`,
      );
      all.push(...(data.result ?? []));
      const nextCursor = (
        data as CfResponse<CfRegistrarRegistration[]> & {
          result_info?: { cursor?: string };
        }
      ).result_info?.cursor;
      if (!nextCursor || nextCursor === cursor) break;
      cursor = nextCursor;
    }

    return all;
  }

  async updateRegistrarAutoRenew(
    domainName: string,
    autoRenew: boolean,
  ): Promise<CfRegistrarRegistration> {
    const data = await this.request<CfRegistrarRegistration>(
      `/accounts/${this.accountId}/registrar/registrations/${encodeURIComponent(domainName)}`,
      {
        method: "PATCH",
        body: JSON.stringify({ auto_renew: autoRenew }),
      },
    );
    return data.result;
  }
}
