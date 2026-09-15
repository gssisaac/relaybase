"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  displayNameForAddress,
  useDomainAddresses,
} from "@/scale/lib/use-domain-addresses";
import { useWorkerDomains } from "@/scale/lib/use-worker-domains";
import { useAutomationDetail } from "@/scale/pages/automations/AutomationDetailContext";
import { scaleApi, ScaleApiError, type AutomationPurpose } from "@/lib/scale/api";

export function AutomationSettingsView() {
  const { automationId, automation, setAutomation } = useAutomationDetail();
  const { readyDomainNames, loading: domainsLoading, refresh: refreshWorkerDomains } =
    useWorkerDomains();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sendDomain, setSendDomain] = useState<string | null>(null);
  const { domainAddresses, displayNameOptions, loading: addressesLoading } =
    useDomainAddresses(sendDomain);

  const [fromName, setFromName] = useState<string | null>(null);
  const [fromEmail, setFromEmail] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [purpose, setPurpose] = useState<AutomationPurpose>("transactional");
  const [saving, setSaving] = useState(false);
  const [identityError, setIdentityError] = useState<string | null>(null);

  useEffect(() => {
    void refreshWorkerDomains();
  }, [refreshWorkerDomains]);

  useEffect(() => {
    if (!automation) return;
    setName(automation.name);
    setDescription(automation.description ?? "");
    setSendDomain(automation.domain || null);
    setFromName(automation.fromName ?? null);
    setFromEmail(automation.fromEmail ?? null);
    setReplyTo(automation.replyTo ?? null);
    setPurpose(automation.purpose);
  }, [automation]);

  const domainOptionValues = useMemo(() => {
    const values = new Set(readyDomainNames);
    const pinned = (sendDomain ?? automation?.domain)?.trim();
    if (pinned) values.add(pinned);
    return [...values].sort((a, b) => a.localeCompare(b));
  }, [readyDomainNames, sendDomain, automation?.domain]);

  const emailOptions = useMemo(() => {
    const emails = domainAddresses.map((a) => a.email);
    if (fromEmail && !emails.some((e) => e.toLowerCase() === fromEmail.toLowerCase())) {
      emails.unshift(fromEmail);
    }
    if (replyTo && !emails.some((e) => e.toLowerCase() === replyTo.toLowerCase())) {
      emails.unshift(replyTo);
    }
    return [...new Set(emails)];
  }, [domainAddresses, fromEmail, replyTo]);

  const nameOptions = useMemo(() => {
    const names = [...displayNameOptions];
    if (fromName && !names.includes(fromName)) names.unshift(fromName);
    return names;
  }, [displayNameOptions, fromName]);

  const allowedEmails = useMemo(
    () => new Set(emailOptions.map((e) => e.toLowerCase())),
    [emailOptions],
  );

  async function saveSettings() {
    if (!sendDomain) {
      setIdentityError("Select a sending domain");
      return;
    }
    if (fromEmail && !allowedEmails.has(fromEmail.toLowerCase())) {
      setIdentityError("Select a sender address from your accounts on this domain");
      return;
    }
    if (replyTo && !allowedEmails.has(replyTo.toLowerCase())) {
      setIdentityError("Select a reply-to address from your accounts on this domain");
      return;
    }
    setIdentityError(null);
    setSaving(true);
    try {
      const updated = await scaleApi.updateAutomation(automationId, {
        name: name.trim(),
        description: description.trim() || null,
        domain: sendDomain.trim().toLowerCase(),
        fromName: fromName?.trim() || null,
        fromEmail: fromEmail?.trim() || null,
        replyTo: replyTo?.trim() || null,
        purpose,
      });
      setAutomation(updated);
      toast.success("Settings saved");
    } catch (e) {
      toast.error(e instanceof ScaleApiError ? e.message : "Could not save settings");
    } finally {
      setSaving(false);
    }
  }

  async function archive() {
    try {
      const updated = await scaleApi.updateAutomation(automationId, { listStatus: "archived" });
      setAutomation(updated);
      toast.success("Automation archived");
    } catch {
      toast.error("Could not archive");
    }
  }

  if (!automation) return null;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 p-4">
      <Card>
        <CardHeader>
          <CardTitle>General</CardTitle>
          <CardDescription>Name, domain, and sender identity for this automation.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="auto-name">Name</Label>
            <Input id="auto-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="auto-desc">Description</Label>
            <Input
              id="auto-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Purpose</Label>
            <Select value={purpose} onValueChange={(v) => setPurpose(v as AutomationPurpose)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="transactional">Transactional</SelectItem>
                <SelectItem value="conversational">Conversational</SelectItem>
                <SelectItem value="marketing">Marketing</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="auto-domain">Domain</Label>
            <Select
              value={sendDomain}
              onValueChange={(next) => {
                if (!next) {
                  setSendDomain(null);
                  return;
                }
                setSendDomain(next);
                if (fromEmail && !fromEmail.toLowerCase().endsWith(`@${next.toLowerCase()}`)) {
                  setFromEmail(null);
                  setFromName(null);
                }
                if (replyTo && !replyTo.toLowerCase().endsWith(`@${next.toLowerCase()}`)) {
                  setReplyTo(null);
                }
              }}
              disabled={domainsLoading && domainOptionValues.length === 0}
            >
              <SelectTrigger id="auto-domain" className="w-full">
                <SelectValue
                  placeholder={
                    domainsLoading
                      ? "Loading domains…"
                      : domainOptionValues.length === 0
                        ? "No domains in Console"
                        : "Select sending domain"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {domainOptionValues.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {domainsLoading ? (
              <p className="text-xs text-muted-foreground">Loading domains from Worker…</p>
            ) : domainOptionValues.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No domains on your Worker — add one in Console → Domains.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Same Worker domain catalog as broadcasts and audience groups.
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="auto-from-email">From email</Label>
            <Select
              value={fromEmail}
              onValueChange={(email) => {
                if (!email) {
                  setFromEmail(null);
                  return;
                }
                setFromEmail(email);
                const match = domainAddresses.find((a) => a.email === email);
                if (match) setFromName(displayNameForAddress(match));
              }}
              disabled={!sendDomain || addressesLoading || emailOptions.length === 0}
            >
              <SelectTrigger id="auto-from-email" className="w-full">
                <SelectValue
                  placeholder={
                    !sendDomain
                      ? "Select a domain first"
                      : addressesLoading
                        ? "Loading accounts…"
                        : emailOptions.length === 0
                          ? "No senders on this domain"
                          : "Select sender address"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {emailOptions.map((email) => (
                  <SelectItem key={email} value={email}>
                    {email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="auto-from-name">From name</Label>
            <Select
              value={fromName}
              onValueChange={(next) => setFromName(next)}
              disabled={nameOptions.length === 0}
            >
              <SelectTrigger id="auto-from-name" className="w-full">
                <SelectValue placeholder="Select display name" />
              </SelectTrigger>
              <SelectContent>
                {nameOptions.map((n) => (
                  <SelectItem key={n} value={n}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Senders come from Accounts on {sendDomain ?? "the selected domain"}.
              {domainAddresses.length === 0 && !addressesLoading && sendDomain
                ? " Add an address in Console → Accounts first."
                : null}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="auto-reply-to">Reply-To</Label>
            <Select
              value={replyTo}
              onValueChange={(email) => setReplyTo(email ?? null)}
              disabled={!sendDomain || addressesLoading || emailOptions.length === 0}
            >
              <SelectTrigger id="auto-reply-to" className="w-full">
                <SelectValue
                  placeholder={
                    !sendDomain
                      ? "Select a domain first"
                      : addressesLoading
                        ? "Loading accounts…"
                        : emailOptions.length === 0
                          ? "No accounts on this domain"
                          : "Select reply-to address"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {emailOptions.map((email) => (
                  <SelectItem key={`reply-${email}`} value={email}>
                    {email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {identityError ? <p className="text-xs text-destructive">{identityError}</p> : null}
          <p className="text-xs text-muted-foreground">
            Compliance footer identity is edited on the Content tab.
          </p>
          <Button onClick={() => void saveSettings()} disabled={saving}>
            {saving ? "Saving…" : "Save settings"}
          </Button>
        </CardContent>
      </Card>

      {automation.listStatus !== "archived" ? (
        <Card>
          <CardHeader>
            <CardTitle>Archive</CardTitle>
            <CardDescription>Hide this automation from the list and pause sends.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="destructive" onClick={() => void archive()}>
              Archive automation
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
