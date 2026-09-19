import type { Message, StudioDataStore } from "@db/types";
import { messageFileStore } from "@services/message/message-file-store";
import {
  getLayoutHtml,
  getLayoutSchema,
  messageIdForOwner,
  requireMessage,
  resolveMessage,
  rowMessageId,
} from "@services/message/resolve";
import {
  createMessage,
  createMessageForOwner,
  forkMessageFromTemplate,
  patchMessage,
} from "@services/message/message";
import { applyMergeTagValues, recipientDisplayName } from "@services/message/merge-tags";
import { triggerSource } from "@services/message/resolve";
import { serializeMessage } from "@services/message/serialize-message";
import { serializeTemplate } from "@services/message/serialize-template";
import { ensureOwnerMessageFiles } from "@services/message/ensure-owner-message-files";
import { studioRepos } from "@services/repositories";
import { studioDocumentService } from "@services/studio/service";

export class MessageService {
  private static instance: MessageService;

  static getInstance(): MessageService {
    if (!MessageService.instance) {
      MessageService.instance = new MessageService();
    }
    return MessageService.instance;
  }

  listLibrary(): Message[] {
    return messageFileStore.listLibrary();
  }

  listForGallery(): Message[] {
    return messageFileStore.listForGallery();
  }

  listAll(): Message[] {
    return messageFileStore.listAll();
  }

  findById(id: string): Message | undefined {
    return messageFileStore.findById(id);
  }

  layoutIsReferenced(layoutId: string): boolean {
    return messageFileStore.layoutIsReferenced(layoutId);
  }

  resolveMessage(data: StudioDataStore, messageId: string) {
    return resolveMessage(data, messageId);
  }

  requireMessage(data: StudioDataStore, messageId: string) {
    return requireMessage(data, messageId);
  }

  getLayoutHtml(data: StudioDataStore, layoutId: string | null | undefined) {
    return getLayoutHtml(data, layoutId);
  }

  getLayoutSchema(data: StudioDataStore, layoutId: string | null | undefined) {
    return getLayoutSchema(data, layoutId);
  }

  rowMessageId(row: { messageId: string }) {
    return rowMessageId(row);
  }

  messageIdForOwner(ownerId: string) {
    return messageIdForOwner(ownerId);
  }

  serializeMessage(row: Message) {
    return serializeMessage(row);
  }

  ensureOwnerMessageFiles(store: StudioDataStore): boolean {
    return ensureOwnerMessageFiles(store);
  }

  delete(id: string) {
    return messageFileStore.delete(id);
  }

  create(...args: Parameters<typeof createMessage>) {
    return createMessage(...args);
  }

  createForOwner(...args: Parameters<typeof createMessageForOwner>) {
    return createMessageForOwner(...args);
  }

  forkFromTemplate(...args: Parameters<typeof forkMessageFromTemplate>) {
    return forkMessageFromTemplate(...args);
  }

  patch(...args: Parameters<typeof patchMessage>) {
    return patchMessage(...args);
  }

  serializeTemplateRow(...args: Parameters<typeof serializeTemplate>) {
    return serializeTemplate(...args);
  }

  applyMergeTags(...args: Parameters<typeof applyMergeTagValues>) {
    return applyMergeTagValues(...args);
  }

  recipientDisplayName(...args: Parameters<typeof recipientDisplayName>) {
    return recipientDisplayName(...args);
  }

  triggerSource(...args: Parameters<typeof triggerSource>) {
    return triggerSource(...args);
  }

  readDocument() {
    return studioDocumentService.read();
  }

  mutateDocument(mutator: Parameters<typeof studioDocumentService.mutate>[0]) {
    return studioDocumentService.mutate(mutator);
  }

  async saveMessage(message: Message): Promise<Message> {
    studioDocumentService.mutate((draft) => {
      const idx = draft.messages.findIndex((m) => m.id === message.id);
      if (idx >= 0) draft.messages[idx] = message;
      else draft.messages.push(message);
    });
    await studioRepos.message().save({
      id: message.id,
      accountLinkId: message.accountLinkId,
      name: message.name,
      subject: message.subject,
      previewText: message.previewText ?? null,
      bodyMarkdown: message.bodyMarkdown,
      layoutId: message.layoutId,
      templateVariables: message.templateVariables ?? {},
      forkedFromTemplateId: message.forkedFromTemplateId ?? null,
      createdAt: new Date(message.createdAt),
      updatedAt: new Date(message.updatedAt),
    } as never);
    return message;
  }
}

export const messageService = MessageService.getInstance();
