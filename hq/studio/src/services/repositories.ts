import type { EntityTarget, ObjectLiteral, Repository } from "typeorm";

import {
  AccountLinkEntity,
  AccountSuppressionEntity,
  ActivityEntity,
  ComplianceIdentityEntity,
  HqAuthUserEntity,
  HqPasswordResetTokenEntity,
  HqRefreshTokenEntity,
  LayoutEntity,
  MessageAssetEntity,
  MessageEntity,
  NewsletterAssetEntity,
  NewsletterEntity,
  PipelineCardEntity,
  RecipientEntity,
  ScheduledJobEntity,
  SubscriberGroupEntity,
  SubscriberMemberEntity,
  SubscriberSyncRunEntity,
  TemplateEntity,
  TrackingEventEntity,
  TriggerAssetEntity,
  TriggerEntity,
  TriggerEventEntity,
  TriggerSendEntity,
  TriggerTrackingEventEntity,
} from "@db/entities";
import { getStudioDataSource } from "@lib/orm/data-source";

export function repo<T extends ObjectLiteral>(entity: EntityTarget<T>): Repository<T> {
  return getStudioDataSource().getRepository(entity);
}

export const studioRepos = {
  accountLink: () => repo(AccountLinkEntity),
  complianceIdentity: () => repo(ComplianceIdentityEntity),
  layout: () => repo(LayoutEntity),
  template: () => repo(TemplateEntity),
  message: () => repo(MessageEntity),
  subscriberGroup: () => repo(SubscriberGroupEntity),
  subscriberMember: () => repo(SubscriberMemberEntity),
  subscriberSyncRun: () => repo(SubscriberSyncRunEntity),
  newsletter: () => repo(NewsletterEntity),
  recipient: () => repo(RecipientEntity),
  trackingEvent: () => repo(TrackingEventEntity),
  trigger: () => repo(TriggerEntity),
  triggerEvent: () => repo(TriggerEventEntity),
  triggerSend: () => repo(TriggerSendEntity),
  triggerTrackingEvent: () => repo(TriggerTrackingEventEntity),
  accountSuppression: () => repo(AccountSuppressionEntity),
  scheduledJob: () => repo(ScheduledJobEntity),
  pipelineCard: () => repo(PipelineCardEntity),
  activity: () => repo(ActivityEntity),
  messageAsset: () => repo(MessageAssetEntity),
  newsletterAsset: () => repo(NewsletterAssetEntity),
  triggerAsset: () => repo(TriggerAssetEntity),
} as const;

export const authRepos = {
  user: () => repo(HqAuthUserEntity),
  refreshToken: () => repo(HqRefreshTokenEntity),
  passwordResetToken: () => repo(HqPasswordResetTokenEntity),
} as const;
