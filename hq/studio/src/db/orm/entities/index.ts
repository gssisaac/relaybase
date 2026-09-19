import {
  HqAuthUserEntity,
  HqPasswordResetTokenEntity,
  HqRefreshTokenEntity,
} from "./auth.entities";
import {
  LayoutEntity,
  MessageAssetEntity,
  MessageEntity,
  NewsletterAssetEntity,
  TemplateEntity,
  TriggerAssetEntity,
} from "./content.entities";
import { NewsletterEntity, RecipientEntity, TrackingEventEntity } from "./newsletter.entities";
import {
  AccountSuppressionEntity,
  ActivityEntity,
  PipelineCardEntity,
  ScheduledJobEntity,
} from "./ops.entities";
import {
  SubscriberGroupEntity,
  SubscriberMemberEntity,
  SubscriberSyncRunEntity,
} from "./subscriber.entities";
import { AccountLinkEntity, ComplianceIdentityEntity } from "./tenant.entities";
import {
  TriggerEntity,
  TriggerEventEntity,
  TriggerSendEntity,
  TriggerTrackingEventEntity,
} from "./trigger.entities";

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
