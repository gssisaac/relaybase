import { CloudflareClient } from "./cloudflare-client";

export type InboundRoutingEntry = {
  address: string;
  /** When false, Email Routing action is `drop`. Default true → Worker. */
  inboundEnabled?: boolean;
};

export type InboundRoutingResult = {
  domain: string;
  zoneId: string;
  routingEnabled: boolean;
  rules: Array<{
    address: string;
    ruleId: string;
    action: "worker" | "drop";
  }>;
};

type CfEmailRoutingRule = {
  id: string;
  enabled: boolean;
  matchers: Array<{ type: string; field?: string; value?: string }>;
  actions: Array<{ type: string; value?: string[] }>;
};

async function resolveZoneId(
  cf: CloudflareClient,
  domain: string,
): Promise<string> {
  const zoneId = await cf.resolveZoneId(domain);
  if (!zoneId) {
    throw new Error(
      `Could not resolve Cloudflare zone for ${domain} — ensure the domain is on this account`,
    );
  }
  return zoneId;
}

function matchesAddress(
  rule: CfEmailRoutingRule,
  address: string,
): boolean {
  return rule.matchers.some(
    (matcher) =>
      matcher.type === "literal" &&
      matcher.field === "to" &&
      matcher.value?.toLowerCase() === address.toLowerCase(),
  );
}

/**
 * Ensure Email Routing is enabled and each address has a literal-To rule:
 * receive → Worker, inboundEnabled false → drop.
 */
export async function ensureInboundRouting(
  cf: CloudflareClient,
  domain: string,
  entries: InboundRoutingEntry[],
  workerScriptName: string,
): Promise<InboundRoutingResult> {
  const zoneId = await resolveZoneId(cf, domain);
  const routing = await cf.getEmailRoutingSettings(zoneId);
  if (!routing.enabled) {
    await cf.enableEmailRouting(zoneId);
  }

  const existing = await cf.listEmailRoutingRules(zoneId);
  const rules: InboundRoutingResult["rules"] = [];

  for (const entry of entries) {
    const address = entry.address.trim().toLowerCase();
    if (!address) continue;
    const receive = entry.inboundEnabled !== false;
    const action = receive
      ? ({ type: "worker" as const, value: [workerScriptName] })
      : ({ type: "drop" as const });
    const ruleAction: "worker" | "drop" = receive ? "worker" : "drop";
    const ruleName = receive
      ? `Store ${address} in Worker`
      : `Drop inbound for ${address}`;

    const current = existing.find((rule) => matchesAddress(rule, address));
    if (current) {
      const updated = await cf.updateEmailRoutingRule(zoneId, current.id, {
        enabled: true,
        actions: [action],
        matchers: [{ type: "literal", field: "to", value: address }],
      });
      rules.push({
        address,
        ruleId: updated.id,
        action: ruleAction,
      });
      continue;
    }

    const created = await cf.createEmailRoutingRule(zoneId, {
      name: ruleName,
      enabled: true,
      priority: 0,
      matchers: [{ type: "literal", field: "to", value: address }],
      actions: [action],
    });
    rules.push({
      address,
      ruleId: created.id,
      action: ruleAction,
    });
  }

  return {
    domain,
    zoneId,
    routingEnabled: true,
    rules,
  };
}

/** @deprecated Prefer ensureInboundRouting — always wires Worker receive. */
export async function ensureInboundWorkerRouting(
  cf: CloudflareClient,
  domain: string,
  addresses: string[],
  workerScriptName: string,
): Promise<InboundRoutingResult> {
  return ensureInboundRouting(
    cf,
    domain,
    addresses.map((address) => ({ address, inboundEnabled: true })),
    workerScriptName,
  );
}

export type RemoveInboundRoutingResult = {
  domain: string;
  zoneId: string;
  removed: Array<{ address: string; ruleId: string }>;
};

/** Delete Cloudflare Email Routing rules for the given addresses (literal To matchers). */
export async function removeInboundWorkerRouting(
  cf: CloudflareClient,
  domain: string,
  addresses: string[],
): Promise<RemoveInboundRoutingResult> {
  const zoneId = await resolveZoneId(cf, domain);
  const existing = await cf.listEmailRoutingRules(zoneId);
  const targets = new Set(
    addresses.map((address) => address.trim().toLowerCase()).filter(Boolean),
  );
  const removed: RemoveInboundRoutingResult["removed"] = [];

  for (const address of targets) {
    const matches = existing.filter((rule) => matchesAddress(rule, address));
    for (const rule of matches) {
      await cf.deleteEmailRoutingRule(zoneId, rule.id);
      removed.push({ address, ruleId: rule.id });
    }
  }

  return { domain, zoneId, removed };
}
