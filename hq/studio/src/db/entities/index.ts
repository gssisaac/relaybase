import {
  HqAuthUserEntity,
  HqPasswordResetTokenEntity,
  HqRefreshTokenEntity,
} from "@db/entities/auth.entities";
import {
  LayoutEntity,
  MessageAssetEntity,
  MessageEntity,
  NewsletterAssetEntity,
  TemplateEntity,
  TriggerAssetEntity,
} from "@db/entities/content.entities";
import { NewsletterEntity, RecipientEntity, TrackingEventEntity } from "@db/entities/newsletter.entities";
import {
  AccountSuppressionEntity,
  ActivityEntity,
  PipelineCardEntity,
  ScheduledJobEntity,
} from "@db/entities/ops.entities";
import {
  SubscriberGroupEntity,
  SubscriberMemberEntity,
  SubscriberSyncRunEntity,
} from "@db/entities/subscriber.entities";
import { AccountLinkEntity, ComplianceIdentityEntity } from "@db/entities/tenant.entities";
import {
  TriggerEntity,
  TriggerEventEntity,
  TriggerSendEntity,
  TriggerTrackingEventEntity,
} from "@db/entities/trigger.entities";

export const studioOrmEntities = [
  AccountLinkEntity,
  ComplianceIdentityEntity,
  LayoutEntity,
  TemplateEntity,
  MessageEntity,
  MessageAssetEntity,
  NewsletterAssetEntity,
  TriggerAssetEntity,
  SubscriberGroupEntity,
  SubscriberMemberEntity,
  SubscriberSyncRunEntity,
  NewsletterEntity,
  RecipientEntity,
  TrackingEventEntity,
  TriggerEntity,
  TriggerEventEntity,
  TriggerSendEntity,
  TriggerTrackingEventEntity,
  AccountSuppressionEntity,
  ScheduledJobEntity,
  PipelineCardEntity,
  ActivityEntity,
  HqAuthUserEntity,
  HqRefreshTokenEntity,
  HqPasswordResetTokenEntity,
] as const;

export {
  AccountLinkEntity,
  ComplianceIdentityEntity,
  LayoutEntity,
  TemplateEntity,
  MessageEntity,
  MessageAssetEntity,
  NewsletterAssetEntity,
  TriggerAssetEntity,
  SubscriberGroupEntity,
  SubscriberMemberEntity,
  SubscriberSyncRunEntity,
  NewsletterEntity,
  RecipientEntity,
  TrackingEventEntity,
  TriggerEntity,
  TriggerEventEntity,
  TriggerSendEntity,
  TriggerTrackingEventEntity,
  AccountSuppressionEntity,
  ScheduledJobEntity,
  PipelineCardEntity,
  ActivityEntity,
  HqAuthUserEntity,
  HqRefreshTokenEntity,
  HqPasswordResetTokenEntity,
};
