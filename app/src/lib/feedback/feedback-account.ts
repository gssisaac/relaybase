export type FeedbackAccountContext = {
  productId?: string;
  sessionRole?: "owner" | "invited" | "none";
  workerUrl?: string;
  accountEmail?: string;
  enabledMailAccounts?: string[];
  studioSignedIn?: boolean;
  cloudAccountId?: string;
  cloudAccountName?: string;
};

export function sanitizeFeedbackAccount(
  raw: unknown,
): FeedbackAccountContext | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const ctx: FeedbackAccountContext = {};
  if (typeof o.productId === "string" && o.productId.trim()) {
    ctx.productId = o.productId.trim().slice(0, 128);
  }
  if (o.sessionRole === "owner" || o.sessionRole === "invited" || o.sessionRole === "none") {
    ctx.sessionRole = o.sessionRole;
  }
  if (typeof o.workerUrl === "string" && o.workerUrl.trim()) {
    ctx.workerUrl = o.workerUrl.trim().slice(0, 512);
  }
  if (typeof o.accountEmail === "string" && o.accountEmail.trim()) {
    ctx.accountEmail = o.accountEmail.trim().slice(0, 320);
  }
  if (Array.isArray(o.enabledMailAccounts)) {
    ctx.enabledMailAccounts = o.enabledMailAccounts
      .filter((e): e is string => typeof e === "string" && e.includes("@"))
      .slice(0, 32)
      .map((e) => e.trim().toLowerCase());
  }
  if (typeof o.studioSignedIn === "boolean") {
    ctx.studioSignedIn = o.studioSignedIn;
  }
  if (typeof o.cloudAccountId === "string" && o.cloudAccountId.trim()) {
    ctx.cloudAccountId = o.cloudAccountId.trim().slice(0, 128);
  }
  if (typeof o.cloudAccountName === "string" && o.cloudAccountName.trim()) {
    ctx.cloudAccountName = o.cloudAccountName.trim().slice(0, 256);
  }
  return Object.keys(ctx).length > 0 ? ctx : undefined;
}
