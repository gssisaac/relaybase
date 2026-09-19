#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../src/routes");

const SERVICE_IMPORT = `import {
  accountService,
  analyticsService,
  assetService,
  DEV_ACCOUNT_LINK_ID,
  messageService,
  newsletterService,
  subscriberGroupService,
  studioDocumentService,
  templateService,
  trackingService,
  triggerService,
} from "@services/index";
`;

const REPLACEMENTS = [
  ["readStudioDocument()", "studioDocumentService.read()"],
  ["mutateStudioDocument(", "studioDocumentService.mutate("],
  ["serializeNewsletter(", "newsletterService.serialize("],
  ["findNewsletter(", "newsletterService.findInDocument("],
  ["getNewsletterLayoutHtml(", "newsletterService.layoutHtml("],
  ["getNewsletterLayoutSchema(", "newsletterService.layoutSchema("],
  ["claimNewsletterForSend(", "newsletterService.claimForSend("],
  ["resolveTestSendUnsubscribeToken(", "newsletterService.resolveTestSendUnsubscribeToken("],
  ["dispatchNewsletterToSubscribers(", "newsletterService.dispatchToSubscribers("],
  ["buildNewsletterDispatchProgress(", "newsletterService.dispatchProgress("],
  ["aggregateNewsletterLinkClicks(", "newsletterService.linkClickAggregate("],
  ["buildSentOverview(", "newsletterService.buildSentOverview("],
  ["buildNewsletterInProgressOverview(", "newsletterService.buildInProgressOverview("],
  ["slugifyNewsletter(", "newsletterService.slugify("],
  ["emptyNewsletterStats(", "newsletterService.emptyStats("],
  ["refreshNewsletterSubscriberLink(", "newsletterService.refreshSubscriberLink("],
  ["serializeNewsletterSubscriberContact(", "newsletterService.serializeSubscriberContact("],
  ["newsletterSubject(", "newsletterService.subject("],
  ["listSubscriberContactsForBroadcast(", "subscriberGroupService.listContactsForBroadcast("],
  ["findSubscriberGroup(", "subscriberGroupService.findGroup("],
  ["resolveActiveSubscriberContacts(", "subscriberGroupService.resolveActiveContacts("],
  ["sanitizeTemplateVariables(", "templateService.sanitizeVariables("],
  ["resolveTemplateVariableDefaults(", "templateService.resolveVariableDefaults("],
  ["createMessageForOwner(", "messageService.createForOwner("],
  ["forkMessageFromTemplate(", "messageService.forkFromTemplate("],
  ["createMessage(", "messageService.create("],
  ["patchMessage(", "messageService.patch("],
  ["requireMessage(", "messageService.requireMessage("],
  ["serializeMessage(", "messageService.serializeMessage("],
  ["serializeTemplate(", "messageService.serializeTemplateRow("],
  ["messageFileStore.", "messageService."],
  ["messageFileStore", "messageService"],
  ["applyMergeTagValues(", "messageService.applyMergeTags("],
  ["recipientDisplayName(", "messageService.recipientDisplayName("],
  ["triggerSource(", "messageService.triggerSource("],
  ["templateCatalogStore.", "templateService."],
  ["serializeLayout(", "templateService.serializeLayout("],
  ["prepareTemplateImport(", "templateService.prepareImport("],
  ["canAccessCustomLayout(", "templateService.canAccessCustomLayout("],
  ["layoutReferencedByMessages(", "templateService.layoutReferencedByMessages("],
  ["nextCustomForkName(", "templateService.nextCustomForkName("],
  ["serializeAccountLink(", "accountService.serializeAccountLink("],
  ["accountDefaultComplianceIdentityId(", "accountService.defaultComplianceIdentityId("],
  ["findComplianceIdentity(", "accountService.findComplianceIdentity("],
  ["complianceSettingsFromIdentity(", "accountService.complianceSettingsFromIdentity("],
  ["syncAccountComplianceMirror(", "accountService.syncComplianceMirror("],
  ["listComplianceIdentities(", "accountService.listComplianceIdentities("],
  ["serializeComplianceIdentity(", "accountService.serializeComplianceIdentity("],
  ["isEmailSuppressedForGroup(", "accountService.isEmailSuppressed("],
  ["fetchWorkerCatalogDomainNames(", "accountService.fetchConsoleDomainNames("],
  ["newsletterAssetKey(", "assetService.newsletterAssetKey("],
  ["readDefaultBrandLogoPng(", "templateService.readDefaultBrandLogoPng("],
  ["buildStudioAnalytics(", "analyticsService.buildAnalytics("],
  ["buildStudioDashboard(", "analyticsService.buildDashboard("],
  ["recordTrackingOpen(", "trackingService.recordNewsletterOpen("],
  ["recordTrackingClick(", "trackingService.recordNewsletterClick("],
  ["TRACKING_PIXEL_GIF", "trackingService.trackingPixelGif"],
  ["resolveSafeRedirectTarget(", "trackingService.safeRedirectTarget("],
  ["recordAutomationTrackingOpen(", "trackingService.recordTriggerOpen("],
  ["recordAutomationTrackingClick(", "trackingService.recordTriggerClick("],
  ["serializeTrigger(", "triggerService.serialize("],
  ["serializeTriggerSend(", "triggerService.serializeSend("],
  ["serializeTriggerEvent(", "triggerService.serializeEvent("],
  ["dispatchTriggerSend(", "triggerService.dispatchSend("],
  ["fireTrigger(", "triggerService.fire("],
  ["recordUnmatchedTriggerEvent(", "triggerService.recordUnmatched("],
  ["findTriggerForInbound(", "triggerService.findForInbound("],
  ["findTriggerById(", "triggerService.findByIdInDocument("],
  ["verifyTriggerWebhookSecret(", "triggerService.verifyWebhookSecret("],
  ["slugifyTrigger(", "triggerService.slugify("],
  ["emptyTriggerStats(", "triggerService.emptyStats("],
  ["normalizeTriggerStats(", "triggerService.normalizeStats("],
  ["defaultHttpWebhookTrigger(", "triggerService.defaultHttpWebhookTrigger("],
  ["defaultMailboxInboundTrigger(", "triggerService.defaultMailboxInboundTrigger("],
  ["defaultTriggerForPurpose(", "triggerService.defaultForPurpose("],
  ["buildTriggerStatsOverview(", "triggerService.statsOverview("],
  ["validateTriggerForActivation(", "triggerService.validateForActivation("],
  ["defaultFromForDomain(", "triggerService.defaultFromForDomain("],
  ["mergeTriggerPatch(", "triggerService.mergeTriggerPatch("],
  ["purposeFromInput(", "triggerService.purposeFromInput("],
  ["subscriberGroupToSummary(", "subscriberGroupService.groupToSummary("],
  ["subscriberContactToApi(", "subscriberGroupService.contactToApi("],
  ["mergeDataSource(", "subscriberGroupService.mergeDataSource("],
  ["fetchDataSourceContacts(", "subscriberGroupService.fetchDataSourceContacts("],
  ["setSubscriberContactSendStatus(", "subscriberGroupService.setContactSendStatus("],
  ["syncSubscriberGroupAsync(", "subscriberGroupService.syncGroup("],
  ["lookupUnsubscribeContact(", "subscriberGroupService.lookupUnsubscribeContact("],
  ["performBroadcastUnsubscribe(", "subscriberGroupService.performUnsubscribe("],
  ["resubscribeBroadcastContact(", "subscriberGroupService.resubscribe("],
  ["unsubscribeHtmlPage(", "subscriberGroupService.unsubscribeHtmlPage("],
  ["unsubscribePath(", "subscriberGroupService.unsubscribePath("],
];

/** findTrigger( but not findTriggerForInbound / findTriggerById */
function replaceFindTrigger(body) {
  return body.replace(/\bfindTrigger\(/g, "triggerService.findInDocument(");
}

const LIB_MOVED_PATH =
  /^(?:newsletters|messages|templates|triggers|subscriber-groups|account-link|account\/|tracking|analytics|dashboard|compliance|unsubscribe|assets|worker)\//;

function stripImports(header, shouldRemove) {
  return header.replace(
    /^import\s+(?:type\s+)?\{[\s\S]*?\}\s+from\s+"([^"]+)";?\s*\n/gm,
    (full, spec) => (shouldRemove(spec) ? "" : full),
  );
}

function cleanHeader(header) {
  let h = header;
  h = stripImports(
    h,
    (spec) =>
      spec.startsWith("@services/") &&
      spec !== "@services/index" &&
      spec !== "@services/studio/constants" &&
      spec !== "@services/auth-service",
  );
  h = stripImports(h, (spec) => spec.startsWith("@lib/") && LIB_MOVED_PATH.test(spec.slice("@lib/".length)));
  return h;
}

function fixBareMapCallbacks(body) {
  return body
    .replace(/\.map\(serializeNewsletter\)/g, ".map((row) => newsletterService.serialize(row))")
    .replace(/\.map\(serializeMessage\)/g, ".map((row) => messageService.serializeMessage(row))")
    .replace(/\.map\(serializeLayout\)/g, ".map((row) => templateService.serializeLayout(row))")
    .replace(/\.map\(serializeTriggerEvent\)/g, ".map((event) => triggerService.serializeEvent(event))")
    .replace(
      /\.map\(serializeComplianceIdentity\)/g,
      ".map((row) => accountService.serializeComplianceIdentity(row))",
    )
    .replace(/\.map\(subscriberGroupToSummary\)/g, ".map((g) => subscriberGroupService.groupToSummary(g))")
    .replace(/\.map\(serializeTemplate\)/g, ".map((row) => messageService.serializeTemplateRow(row))")
    .replace(
      /\.map\(serializeTriggerSend\)/g,
      ".map((send) => triggerService.serializeSend(send))",
    );
}

for (const file of fs.readdirSync(ROOT).filter((f) => f.endsWith(".ts"))) {
  const fp = path.join(ROOT, file);
  let text = fs.readFileSync(fp, "utf8");
  const exportMark = text.search(/^export const studio/m);
  if (exportMark < 0) continue;

  let header = text.slice(0, exportMark);
  let body = text.slice(exportMark);

  for (const [from, to] of REPLACEMENTS) {
    body = body.split(from).join(to);
  }
  body = replaceFindTrigger(body);
  body = fixBareMapCallbacks(body);

  header = cleanHeader(header);
  header = header.replace(/import \{ DEV_ACCOUNT_LINK_ID \}[^\n]+\n/g, "");
  header = header.replace(
    /import\s+\{[\s\S]*?\bDEV_ACCOUNT_LINK_ID\b[\s\S]*?\}\s+from\s+"@services\/studio\/constants";?\s*\n/g,
    "",
  );

  if (!header.includes('from "@services/index"')) {
    const honoIdx = header.indexOf('import { Hono }');
    const insertAt = honoIdx >= 0 ? header.indexOf("\n", honoIdx) + 1 : 0;
    header = header.slice(0, insertAt) + SERVICE_IMPORT + header.slice(insertAt);
  }

  text = header + body;
  fs.writeFileSync(fp, text);
  console.log("updated", file);
}
