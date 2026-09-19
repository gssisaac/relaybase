import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from "typeorm";

import { AccountLinkEntity } from "./tenant.entities";
import { MessageEntity } from "./content.entities";

@Entity({ name: "triggers" })
@Index(["accountLinkId", "status"])
export class TriggerEntity {
  @PrimaryColumn({ type: "varchar", length: 64 })
  id!: string;

  @Column({ name: "account_link_id", type: "varchar", length: 64 })
  accountLinkId!: string;

  @ManyToOne(() => AccountLinkEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "account_link_id" })
  accountLink!: AccountLinkEntity;

  @Column({ name: "message_id", type: "varchar", length: 64 })
  messageId!: string;

  @ManyToOne(() => MessageEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "message_id" })
  message!: MessageEntity;

  @Column({ name: "subscriber_group_id", type: "varchar", length: 64, nullable: true })
  subscriberGroupId!: string | null;

  @Column({ name: "compliance_identity_id", type: "varchar", length: 64, nullable: true })
  complianceIdentityId!: string | null;

  @Column({ type: "varchar", length: 255 })
  name!: string;

  @Column({ type: "varchar", length: 255 })
  slug!: string;

  @Column({ type: "text", nullable: true })
  description!: string | null;

  @Column({ type: "varchar", length: 255 })
  domain!: string;

  @Column({ name: "from_name", type: "varchar", length: 255, nullable: true })
  fromName!: string | null;

  @Column({ name: "from_email", type: "varchar", length: 255, nullable: true })
  fromEmail!: string | null;

  @Column({ name: "reply_to", type: "varchar", length: 255, nullable: true })
  replyTo!: string | null;

  @Column({ type: "varchar", length: 32 })
  purpose!: string;

  @Column({ name: "list_status", type: "varchar", length: 32, default: "active" })
  listStatus!: string;

  @Column({ type: "varchar", length: 32, default: "draft" })
  status!: string;

  @Column({ type: "jsonb" })
  source!: Record<string, unknown>;

  @Column({ name: "cooldown_seconds", type: "integer", default: 86400 })
  cooldownSeconds!: number;

  @Column({ name: "apply_marketing_suppression", type: "boolean", default: true })
  applyMarketingSuppression!: boolean;

  @Column({ type: "jsonb", default: {} })
  stats!: Record<string, number>;

  @Column({ name: "last_triggered_at", type: "timestamptz", nullable: true })
  lastTriggeredAt!: Date | null;

  @Column({ name: "last_sent_at", type: "timestamptz", nullable: true })
  lastSentAt!: Date | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}

@Entity({ name: "trigger_events" })
@Index(["accountLinkId"])
@Index(["triggerId"])
export class TriggerEventEntity {
  @PrimaryColumn({ type: "varchar", length: 64 })
  id!: string;

  @Column({ name: "account_link_id", type: "varchar", length: 64 })
  accountLinkId!: string;

  @Column({ name: "trigger_id", type: "varchar", length: 64, nullable: true })
  triggerId!: string | null;

  @Column({ name: "trigger_type", type: "varchar", length: 64 })
  triggerType!: string;

  @Column({ name: "idempotency_key", type: "varchar", length: 255 })
  idempotencyKey!: string;

  @Column({ name: "recipient_email", type: "varchar", length: 255 })
  recipientEmail!: string;

  @Column({ name: "recipient_name", type: "varchar", length: 255, nullable: true })
  recipientName!: string | null;

  @Column({ type: "jsonb", default: {} })
  payload!: Record<string, unknown>;

  @Column({ type: "varchar", length: 32 })
  status!: string;

  @Column({ name: "skip_reason", type: "varchar", length: 64, nullable: true })
  skipReason!: string | null;

  @Column({ name: "occurred_at", type: "timestamptz" })
  occurredAt!: Date;
}

@Entity({ name: "trigger_sends" })
@Index(["triggerId", "status"])
export class TriggerSendEntity {
  @PrimaryColumn({ type: "varchar", length: 64 })
  id!: string;

  @Column({ name: "trigger_id", type: "varchar", length: 64 })
  triggerId!: string;

  @Column({ name: "trigger_event_id", type: "varchar", length: 64 })
  triggerEventId!: string;

  @Column({ name: "subscriber_member_id", type: "varchar", length: 64, nullable: true })
  subscriberMemberId!: string | null;

  @Column({ type: "varchar", length: 255 })
  email!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  name!: string | null;

  @Column({ type: "varchar", length: 32 })
  status!: string;

  @Column({ name: "error_message", type: "text", nullable: true })
  errorMessage!: string | null;

  @Column({ name: "bounce_reason", type: "text", nullable: true })
  bounceReason!: string | null;

  @Column({ name: "open_count", type: "integer", default: 0 })
  openCount!: number;

  @Column({ name: "click_count", type: "integer", default: 0 })
  clickCount!: number;

  @Column({ name: "sent_at", type: "timestamptz", nullable: true })
  sentAt!: Date | null;

  @Column({ name: "delivered_at", type: "timestamptz", nullable: true })
  deliveredAt!: Date | null;

  @Column({ name: "opened_at", type: "timestamptz", nullable: true })
  openedAt!: Date | null;

  @Column({ name: "clicked_at", type: "timestamptz", nullable: true })
  clickedAt!: Date | null;

  @Column({ name: "unsubscribed_at", type: "timestamptz", nullable: true })
  unsubscribedAt!: Date | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;
}

@Entity({ name: "trigger_tracking_events" })
@Index(["triggerId"])
export class TriggerTrackingEventEntity {
  @PrimaryColumn({ type: "varchar", length: 64 })
  id!: string;

  @Column({ name: "trigger_id", type: "varchar", length: 64 })
  triggerId!: string;

  @Column({ name: "trigger_send_id", type: "varchar", length: 64 })
  triggerSendId!: string;

  @Column({ name: "member_email", type: "varchar", length: 255 })
  memberEmail!: string;

  @Column({ type: "varchar", length: 32 })
  type!: string;

  @Column({ type: "text", nullable: true })
  url!: string | null;

  @Column({ type: "text", nullable: true })
  reason!: string | null;

  @Column({ name: "occurred_at", type: "timestamptz" })
  occurredAt!: Date;
}
