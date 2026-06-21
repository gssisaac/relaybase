import { CloudflareClient } from "./cloudflare-client";

export type InboundRoutingResult = {
  domain: string;
  zoneId: string;
  routingEnabled: boolean;
  rules: Array<{
    address: string;
    ruleId: string;
    action: "worker";
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

export async function ensureInboundWorkerRouting(
  cf: CloudflareClient,
  domain: string,
  addresses: string[],
  workerScriptName: string,
): Promise<InboundRoutingResult> {
  const zoneId = await resolveZoneId(cf, domain);
  const routing = await cf.getEmailRoutingSettings(zoneId);
  if (!routing.enabled) {
    await cf.enableEmailRouting(zoneId);
  }

  const existing = await cf.listEmailRoutingRules(zoneId);
  const rules: InboundRoutingResult["rules"] = [];

  for (const address of addresses) {
    const current = existing.find((rule) => matchesAddress(rule, address));
    if (current) {
      const updated = await cf.updateEmailRoutingRule(zoneId, current.id, {
        enabled: true,
        actions: [{ type: "worker", value: [workerScriptName] }],
        matchers: [{ type: "literal", field: "to", value: address }],
      });
      rules.push({
        address,
        ruleId: updated.id,
        action: "worker",
      });
      continue;
    }

    const created = await cf.createEmailRoutingRule(zoneId, {
      name: `Store ${address} in Worker`,
      enabled: true,
      priority: 0,
      matchers: [{ type: "literal", field: "to", value: address }],
      actions: [{ type: "worker", value: [workerScriptName] }],
    });
    rules.push({
      address,
      ruleId: created.id,
      action: "worker",
    });
  }

  return {
    domain,
    zoneId,
    routingEnabled: true,
    rules,
  };
}
