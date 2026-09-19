import type { Address } from "@/email/components/mailbox/types";
import type { CmdDropdownOptionGroup } from "@/components/ui/cmd-dropdown";

export function domainOf(email: string, domain?: string): string {
  if (domain?.trim()) return domain.trim().toLowerCase();
  const at = email.indexOf("@");
  return at > 0 ? email.slice(at + 1).toLowerCase() : "";
}

export function localPartOf(email: string): string {
  const at = email.indexOf("@");
  return at > 0 ? email.slice(0, at).toLowerCase() : email.trim().toLowerCase();
}

export function pinAddressCandidates(
  addresses: Address[],
  pinnedEmails: string[],
): Address[] {
  const sorted = [...addresses];
  const seen = new Set(sorted.map((a) => a.email.toLowerCase()));
  const pinned: Address[] = [];
  for (const raw of pinnedEmails) {
    const email = raw.trim().toLowerCase();
    if (!email || seen.has(email)) continue;
    const at = email.indexOf("@");
    pinned.push({
      email,
      domain: at > 0 ? email.slice(at + 1) : "",
    } as Address);
    seen.add(email);
  }
  return [...pinned, ...sorted];
}

export function accountCmdGroups(
  addresses: Address[],
  pinnedEmails: string[] = [],
): CmdDropdownOptionGroup[] {
  const candidates = pinAddressCandidates(addresses, pinnedEmails);
  const byDomain = new Map<string, Address[]>();
  for (const address of candidates) {
    const domain = domainOf(address.email, address.domain);
    if (!domain) continue;
    const list = byDomain.get(domain) ?? [];
    list.push(address);
    byDomain.set(domain, list);
  }
  return [...byDomain.keys()]
    .sort((a, b) => a.localeCompare(b))
    .map((domain) => ({
      heading: domain,
      options: (byDomain.get(domain) ?? []).map((address) => {
        const email = address.email;
        const local = localPartOf(email);
        return {
          value: email.toLowerCase(),
          label: email,
          keywords: [domain, local, email].join(" "),
        };
      }),
    }));
}
