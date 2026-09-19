import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  Unique,
  UpdateDateColumn,
} from "typeorm";

import { AccountLinkEntity } from "./tenant.entities";

@Entity({ name: "subscriber_groups" })
export class SubscriberGroupEntity {
  @PrimaryColumn({ type: "varchar", length: 64 })
  id!: string;

  @Column({ name: "account_link_id", type: "varchar", length: 64 })
  accountLinkId!: string;

  @ManyToOne(() => AccountLinkEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "account_link_id" })
  accountLink!: AccountLinkEntity;

  @Column({ type: "varchar", length: 255 })
  name!: string;

  @Column({ type: "varchar", length: 255 })
  domain!: string;

  @Column({ name: "default_from", type: "varchar", length: 255, nullable: true })
  defaultFrom!: string | null;

  @Column({ name: "data_source", type: "jsonb", nullable: true })
  dataSource!: Record<string, unknown> | null;

  @Column({ name: "cron_enabled", type: "boolean", default: false })
  cronEnabled!: boolean;

  @Column({ name: "cron_interval_minutes", type: "integer", default: 60 })
  cronIntervalMinutes!: number;

  @Column({ name: "last_sync_at", type: "timestamptz", nullable: true })
  lastSyncAt!: Date | null;

  @Column({ name: "last_sync_status", type: "varchar", length: 32, nullable: true })
  lastSyncStatus!: string | null;

  @Column({ name: "last_sync_error", type: "text", nullable: true })
  lastSyncError!: string | null;

  @Column({ name: "last_sync_count", type: "integer", nullable: true })
  lastSyncCount!: number | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}

@Entity({ name: "subscriber_members" })
@Unique(["subscriberGroupId", "email"])
export class SubscriberMemberEntity {
  @PrimaryColumn({ type: "varchar", length: 64 })
  id!: string;

  @Column({ name: "subscriber_group_id", type: "varchar", length: 64 })
  subscriberGroupId!: string;

  @ManyToOne(() => SubscriberGroupEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "subscriber_group_id" })
  subscriberGroup!: SubscriberGroupEntity;

  @Index()
  @Column({ type: "varchar", length: 255 })
  email!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  name!: string | null;

  @Column({ type: "varchar", length: 32 })
  source!: string;

  @Index()
  @Column({ name: "send_status", type: "varchar", length: 32, default: "active" })
  sendStatus!: string;

  @Index({ unique: true })
  @Column({ name: "unsubscribe_token", type: "varchar", length: 128 })
  unsubscribeToken!: string;

  @Column({ name: "added_at", type: "timestamptz" })
  addedAt!: Date;

  @Column({ name: "consented_at", type: "timestamptz", nullable: true })
  consentedAt!: Date | null;

  @Column({ name: "consent_source", type: "varchar", length: 32, nullable: true })
  consentSource!: string | null;

  @Column({ name: "unsubscribed_at", type: "timestamptz", nullable: true })
  unsubscribedAt!: Date | null;

  @Column({ name: "bounced_at", type: "timestamptz", nullable: true })
  bouncedAt!: Date | null;

  @Column({ name: "bounce_reason", type: "text", nullable: true })
  bounceReason!: string | null;
}

@Entity({ name: "subscriber_sync_runs" })
export class SubscriberSyncRunEntity {
  @PrimaryColumn({ type: "varchar", length: 64 })
  id!: string;

  @Column({ name: "subscriber_group_id", type: "varchar", length: 64 })
  subscriberGroupId!: string;

  @ManyToOne(() => SubscriberGroupEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "subscriber_group_id" })
  subscriberGroup!: SubscriberGroupEntity;

  @Column({ type: "varchar", length: 32 })
  trigger!: string;

  @Column({ type: "varchar", length: 32 })
  status!: string;

  @Column({ type: "varchar", length: 32 })
  phase!: string;

  @Column({ name: "total_count", type: "integer", nullable: true })
  totalCount!: number | null;

  @Column({ name: "processed_count", type: "integer", nullable: true })
  processedCount!: number | null;

  @Column({ name: "skipped_count", type: "integer", nullable: true })
  skippedCount!: number | null;

  @Column({ name: "success_count", type: "integer", nullable: true })
  successCount!: number | null;

  @Column({ name: "failed_count", type: "integer", nullable: true })
  failedCount!: number | null;

  @Column({ type: "text", nullable: true })
  error!: string | null;

  @Column({ name: "started_at", type: "timestamptz" })
  startedAt!: Date;

  @Column({ name: "finished_at", type: "timestamptz", nullable: true })
  finishedAt!: Date | null;
}
