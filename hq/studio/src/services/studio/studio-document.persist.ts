import type { EntityTarget, ObjectLiteral, Repository } from "typeorm";

import type { StudioDataStore } from "@db/types";
import {
  AccountLinkEntity,
  AccountSuppressionEntity,
  ActivityEntity,
  ComplianceIdentityEntity,
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
import { mapEntitiesToStore, mapStoreToEntities } from "@lib/orm/store-entity-map";

const CHUNK = 400;

async function saveChunked<T extends ObjectLiteral>(repo: Repository<T>, rows: T[]): Promise<void> {
  for (let i = 0; i < rows.length; i += CHUNK) {
    await repo.save(rows.slice(i, i + CHUNK));
  }
}

/** Upsert all studio entities (no TRUNCATE). */
export async function persistStudioDocument(data: StudioDataStore): Promise<void> {
  const dataSource = getStudioDataSource();
  const mapped = mapStoreToEntities(data);
  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    const repo = <T extends ObjectLiteral>(entity: EntityTarget<T>) =>
      queryRunner.manager.getRepository(entity);

    await repo(AccountLinkEntity).save(mapped.accountRow);
    await saveChunked(repo(ComplianceIdentityEntity), mapped.complianceRows);
    await saveChunked(repo(LayoutEntity), mapped.layoutRows);
    await saveChunked(repo(TemplateEntity), mapped.templateRows);
    await saveChunked(repo(MessageEntity), mapped.messageRows);
    await saveChunked(repo(SubscriberGroupEntity), mapped.subscriberGroupRows);
    await saveChunked(repo(SubscriberMemberEntity), mapped.subscriberMemberRows);
    await saveChunked(repo(SubscriberSyncRunEntity), mapped.subscriberSyncRows);
    await saveChunked(repo(NewsletterEntity), mapped.newsletterRows);
    await saveChunked(repo(TriggerEntity), mapped.triggerRows);
    await saveChunked(repo(RecipientEntity), mapped.recipientRows);
    await saveChunked(repo(TriggerEventEntity), mapped.triggerEventRows);
    await saveChunked(repo(TriggerSendEntity), mapped.triggerSendRows);
    await saveChunked(repo(TrackingEventEntity), mapped.trackingRows);
    await saveChunked(repo(TriggerTrackingEventEntity), mapped.triggerTrackingRows);
    await saveChunked(repo(AccountSuppressionEntity), mapped.suppressionRows);
    await saveChunked(repo(ScheduledJobEntity), mapped.jobRows);
    await saveChunked(repo(PipelineCardEntity), mapped.pipelineRows);
    await saveChunked(repo(ActivityEntity), mapped.activityRows);
    await saveChunked(repo(MessageAssetEntity), mapped.messageAssetRows);
    await saveChunked(repo(NewsletterAssetEntity), mapped.newsletterAssetRows);
    await saveChunked(repo(TriggerAssetEntity), mapped.triggerAssetRows);

    await queryRunner.commitTransaction();
  } catch (err) {
    await queryRunner.rollbackTransaction();
    throw err;
  } finally {
    await queryRunner.release();
  }
}

export async function loadStudioDocumentFromDb(): Promise<StudioDataStore | null> {
  const dataSource = getStudioDataSource();
  const accountCount = await dataSource.getRepository(AccountLinkEntity).count();
  if (accountCount === 0) return null;

  const [
    accountRows,
    complianceRows,
    layoutRows,
    templateRows,
    messageRows,
    subscriberGroupRows,
    subscriberMemberRows,
    subscriberSyncRows,
    newsletterRows,
    recipientRows,
    trackingRows,
    triggerRows,
    triggerEventRows,
    triggerSendRows,
    triggerTrackingRows,
    suppressionRows,
    jobRows,
    pipelineRows,
    activityRows,
    messageAssetRows,
    newsletterAssetRows,
    triggerAssetRows,
  ] = await Promise.all([
    dataSource.getRepository(AccountLinkEntity).find(),
    dataSource.getRepository(ComplianceIdentityEntity).find(),
    dataSource.getRepository(LayoutEntity).find(),
    dataSource.getRepository(TemplateEntity).find(),
    dataSource.getRepository(MessageEntity).find(),
    dataSource.getRepository(SubscriberGroupEntity).find(),
    dataSource.getRepository(SubscriberMemberEntity).find(),
    dataSource.getRepository(SubscriberSyncRunEntity).find(),
    dataSource.getRepository(NewsletterEntity).find(),
    dataSource.getRepository(RecipientEntity).find(),
    dataSource.getRepository(TrackingEventEntity).find(),
    dataSource.getRepository(TriggerEntity).find(),
    dataSource.getRepository(TriggerEventEntity).find(),
    dataSource.getRepository(TriggerSendEntity).find(),
    dataSource.getRepository(TriggerTrackingEventEntity).find(),
    dataSource.getRepository(AccountSuppressionEntity).find(),
    dataSource.getRepository(ScheduledJobEntity).find(),
    dataSource.getRepository(PipelineCardEntity).find(),
    dataSource.getRepository(ActivityEntity).find(),
    dataSource.getRepository(MessageAssetEntity).find(),
    dataSource.getRepository(NewsletterAssetEntity).find(),
    dataSource.getRepository(TriggerAssetEntity).find(),
  ]);

  const accountRow = accountRows[0];
  if (!accountRow) return null;

  return mapEntitiesToStore({
    accountRow,
    complianceRows,
    layoutRows,
    templateRows,
    messageRows,
    subscriberGroupRows,
    subscriberMemberRows,
    subscriberSyncRows,
    newsletterRows,
    recipientRows,
    trackingRows,
    triggerRows,
    triggerEventRows,
    triggerSendRows,
    triggerTrackingRows,
    suppressionRows,
    jobRows,
    pipelineRows,
    activityRows,
    messageAssetRows,
    newsletterAssetRows,
    triggerAssetRows,
  });
}
