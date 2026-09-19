import type { Trigger, TriggerSource } from "@db/types";
import { dispatchTriggerSend } from "@services/trigger/dispatch";
import { fireTrigger, recordUnmatchedTriggerEvent } from "@services/trigger/fire";
import { findTriggerById, findTriggerForInbound } from "@services/trigger/matcher";
import {
  defaultFromForDomain,
  mergeTriggerPatch,
  purposeFromInput,
} from "@services/trigger/patch";
import { slugifyTrigger } from "@services/trigger/slug";
import { emptyTriggerStats, normalizeTriggerStats } from "@services/trigger/stats";
import {
  findTrigger,
  getTriggerLayoutHtml,
  getTriggerLayoutSchema,
  serializeTrigger,
  serializeTriggerEvent,
  serializeTriggerSend,
} from "@services/trigger/serialize";
import { buildTriggerStatsOverview } from "@services/trigger/trigger-stats-overview";
import {
  defaultHttpWebhookTrigger,
  defaultMailboxInboundTrigger,
  defaultTriggerForPurpose,
} from "@services/trigger/trigger-defaults";
import { verifyTriggerWebhookSecret } from "@services/trigger/trigger-auth";
import {
  validateTriggerForActivation,
  validateTriggerSource,
} from "@services/trigger/validate";
import { studioDocumentService } from "@services/studio/service";

export class TriggerService {
  private static instance: TriggerService;

  static getInstance(): TriggerService {
    if (!TriggerService.instance) {
      TriggerService.instance = new TriggerService();
    }
    return TriggerService.instance;
  }

  findInDocument(id: string): Trigger | undefined {
    return findTrigger(id);
  }

  findByIdInDocument(id: string) {
    return findTriggerById(id);
  }

  findForInbound(input: Parameters<typeof findTriggerForInbound>[0]) {
    return findTriggerForInbound(input);
  }

  serialize(...args: Parameters<typeof serializeTrigger>) {
    return serializeTrigger(...args);
  }

  layoutHtml(layoutId: string | null | undefined) {
    return getTriggerLayoutHtml(layoutId);
  }

  layoutSchema(layoutId: string | null | undefined) {
    return getTriggerLayoutSchema(layoutId);
  }

  validateSource(source: TriggerSource) {
    return validateTriggerSource(source);
  }

  validateForActivation(automation: Trigger) {
    return validateTriggerForActivation(automation);
  }

  normalizeStats(stats: Trigger["stats"]) {
    return normalizeTriggerStats(stats);
  }

  emptyStats() {
    return emptyTriggerStats();
  }

  slugify(name: string) {
    return slugifyTrigger(name);
  }

  defaultHttpWebhookTrigger() {
    return defaultHttpWebhookTrigger();
  }

  defaultMailboxInboundTrigger(domain?: string, localPart?: string) {
    return defaultMailboxInboundTrigger(domain, localPart);
  }

  defaultForPurpose(purpose?: Parameters<typeof defaultTriggerForPurpose>[0]) {
    return defaultTriggerForPurpose(purpose);
  }

  defaultFromForDomain(domain: string) {
    return defaultFromForDomain(domain);
  }

  purposeFromInput(raw: string | undefined) {
    return purposeFromInput(raw);
  }

  mergeTriggerPatch(
    existing: Parameters<typeof mergeTriggerPatch>[0],
    patch: Parameters<typeof mergeTriggerPatch>[1],
  ) {
    return mergeTriggerPatch(existing, patch);
  }

  serializeSend(input: Parameters<typeof serializeTriggerSend>[0]) {
    return serializeTriggerSend(input);
  }

  serializeEvent(input: Parameters<typeof serializeTriggerEvent>[0]) {
    return serializeTriggerEvent(input);
  }

  statsOverview(...args: Parameters<typeof buildTriggerStatsOverview>) {
    return buildTriggerStatsOverview(...args);
  }

  verifyWebhookSecret(...args: Parameters<typeof verifyTriggerWebhookSecret>) {
    return verifyTriggerWebhookSecret(...args);
  }

  fire(input: Parameters<typeof fireTrigger>[0]) {
    return fireTrigger(input);
  }

  recordUnmatched(input: Parameters<typeof recordUnmatchedTriggerEvent>[0]) {
    return recordUnmatchedTriggerEvent(input);
  }

  dispatchSend(
    automation: Parameters<typeof dispatchTriggerSend>[0],
    send: Parameters<typeof dispatchTriggerSend>[1],
    payload: Parameters<typeof dispatchTriggerSend>[2],
  ) {
    return dispatchTriggerSend(automation, send, payload);
  }

  readDocument() {
    return studioDocumentService.read();
  }

  mutateDocument(mutator: Parameters<typeof studioDocumentService.mutate>[0]) {
    return studioDocumentService.mutate(mutator);
  }
}

export const triggerService = TriggerService.getInstance();
