"use client";

import { reaction } from "mobx";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NewsletterPreflightChecklist } from "@/studio/components/newsletters/NewsletterPreflightChecklist";
import {
  complianceFromIdentity,
  effectiveComplianceIdentityId,
  findComplianceIdentityById,
} from "@/studio/lib/compliance/compliance-identity";
import {
  displayNameForRecipient,
  previewPersonaOptions,
  resolvePreviewRecipient,
  type PreviewPersonaId,
} from "@/studio/lib/newsletters/newsletter-merge-tags";
import {
  preflightStatusLabel,
  runNewsletterPreflight,
} from "@/studio/lib/newsletters/newsletter-preflight";
import { studioApi, type StudioAccountCompliance } from "@/studio/api";
import {
  useNewsletterDetail,
  useNewsletterDetailStore,
} from "@/studio/stores/newsletter-detail";

type DraftSnapshot = {
  subject: string;
  bodyMarkdown: string;
  templateId: string;
  templateVariables: Record<string, string>;
};

export function NewsletterPublishPreflightSection() {
  const store = useNewsletterDetailStore();
  const { newsletterId, newsletter, templates, subscriberMembers } = useNewsletterDetail();

  const [draft, setDraft] = useState<DraftSnapshot>(() => ({
    subject: store.draftSubject,
    bodyMarkdown: store.draftBody,
    templateId: store.draftTemplateId,
    templateVariables: { ...store.draftTemplateVariables },
  }));
  const [compliance, setCompliance] = useState<StudioAccountCompliance | null>(null);
  const [previewPersonaId, setPreviewPersonaId] = useState<PreviewPersonaId>("sample-named");
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    return reaction(
      () => ({
        subject: store.draftSubject,
        bodyMarkdown: store.draftBody,
        templateId: store.draftTemplateId,
        templateVariables: store.draftTemplateVariables,
      }),
      (next) =>
        setDraft({
          subject: next.subject,
          bodyMarkdown: next.bodyMarkdown,
          templateId: next.templateId,
          templateVariables: { ...next.templateVariables },
        }),
      { fireImmediately: true },
    );
  }, [store]);

  useEffect(() => {
    setPreviewPersonaId("sample-named");
  }, [newsletterId]);

  useEffect(() => {
    if (!newsletter) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await studioApi.listComplianceIdentities();
        if (cancelled) return;
        const effectiveId = effectiveComplianceIdentityId(
          newsletter.complianceIdentityId,
          res.defaultComplianceIdentityId,
        );
        setCompliance(
          complianceFromIdentity(findComplianceIdentityById(res.identities, effectiveId)),
        );
      } catch {
        if (!cancelled) setCompliance(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [newsletter?.complianceIdentityId, newsletter]);

  const template = templates.find((t) => t.id === draft.templateId);
  const personaOptions = useMemo(
    () => previewPersonaOptions(subscriberMembers),
    [subscriberMembers],
  );
  const previewRecipient = useMemo(
    () => resolvePreviewRecipient(previewPersonaId, subscriberMembers),
    [previewPersonaId, subscriberMembers],
  );

  const checks = useMemo(
    () =>
      runNewsletterPreflight({
        subject: draft.subject,
        bodyMarkdown: draft.bodyMarkdown,
        templateHtml: template?.htmlSource ?? "",
        templateId: draft.templateId,
        templateVariablesSchema: template?.variablesSchema ?? null,
        templateVariables: draft.templateVariables,
        fromEmail: newsletter?.fromEmail ?? null,
        fromName: newsletter?.fromName ?? null,
        compliance,
      }),
    [draft, template, newsletter?.fromEmail, newsletter?.fromName, compliance],
  );

  const statusLabel = preflightStatusLabel(checks);
  const failCount = checks.filter((c) => c.status === "fail").length;
  const warnCount = checks.filter((c) => c.status === "warn").length;

  if (!newsletter) return null;

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
          <div className="min-w-0">
            <CardTitle className="text-sm">Pre-flight</CardTitle>
            <CardDescription>
              Compliance, content, and sender checks before you send or schedule.
            </CardDescription>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={() => setDialogOpen(true)}>
            Check
          </Button>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-muted/20 px-3 py-2.5">
            <p className="text-xs font-medium text-foreground">Preflight status</p>
            <p
              className={
                failCount
                  ? "text-xs font-medium text-destructive"
                  : warnCount
                    ? "text-xs font-medium text-amber-700 dark:text-amber-400"
                    : "text-xs text-muted-foreground"
              }
            >
              {statusLabel}
            </p>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="flex max-h-[min(90vh,640px)] flex-col sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Pre-flight checklist</DialogTitle>
            <DialogDescription>
              Resolve blockers before send. Warnings are recommended fixes.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-foreground">Preview as</p>
              <Select
                value={previewPersonaId}
                onValueChange={(value) => setPreviewPersonaId(value as PreviewPersonaId)}
                items={personaOptions}
              >
                <SelectTrigger size="sm" className="w-full">
                  <SelectValue placeholder="Choose recipient" />
                </SelectTrigger>
                <SelectContent>
                  {personaOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-md border border-border bg-muted/20 p-2.5 text-[11px]">
              <p className="font-medium text-foreground">Resolved recipient</p>
              <dl className="mt-2 space-y-1.5 text-muted-foreground">
                <div className="flex justify-between gap-2">
                  <dt>{`{{contact.name}}`}</dt>
                  <dd className="truncate text-right text-foreground">
                    {displayNameForRecipient(previewRecipient)}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>{`{{contact.email}}`}</dt>
                  <dd className="truncate text-right text-foreground">{previewRecipient.email}</dd>
                </div>
              </dl>
            </div>

            <NewsletterPreflightChecklist checks={checks} newsletterId={newsletterId} />
          </div>
          <DialogFooter>
            <Button size="sm" onClick={() => setDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
