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
import { SubscriberGroupEntity } from "./subscriber.entities";

@Entity({ name: "newsletters" })
@Index(["accountLinkId", "status"])
export class NewsletterEntity {
  @PrimaryColumn({ type: "varchar", length: 64 })
  id!: string;

  @Column({ name: "account_link_id", type: "varchar", length: 64 })
  accountLinkId!: string;

  @ManyToOne(() => AccountLinkEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "account_link_id" })
  accountLink!: AccountLinkEntity;

  @Column({ name: "subscriber_group_id", type: "varchar", length: 64 })
  subscriberGroupId!: string;

  @ManyToOne(() => SubscriberGroupEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "subscriber_group_id" })
  subscriberGroup!: SubscriberGroupEntity;

  @Column({ name: "message_id", type: "varchar", length: 64 })
  messageId!: string;

  @ManyToOne(() => MessageEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "message_id" })
  message!: MessageEntity;

  @Column({ name: "compliance_identity_id", type: "varchar", length: 64, nullable: true })
  complianceIdentityId!: string | null;

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

  @Column({ name: "list_status", type: "varchar", length: 32, default: "active" })
  listStatus!: string;

  @Column({ type: "varchar", length: 32, default: "draft" })
  status!: string;

  @Index()
  @Column({ name: "scheduled_at", type: "timestamptz", nullable: true })
  scheduledAt!: Date | null;

  @Column({ name: "started_at", type: "timestamptz", nullable: true })
  startedAt!: Date | null;

  @Column({ name: "sent_at", type: "timestamptz", nullable: true })
  sentAt!: Date | null;

  @Column({ name: "finished_at", type: "timestamptz", nullable: true })
  finishedAt!: Date | null;

  @Column({ name: "target_filter", type: "jsonb", nullable: true })
  targetFilter!: Record<string, unknown> | null;

  @Column({ type: "jsonb", default: {} })
  stats!: Record<string, number>;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}

@Entity({ name: "recipients" })
@Index(["newsletterId", "status"])
export class RecipientEntity {
  @PrimaryColumn({ type: "varchar", length: 64 })
  id!: string;

  @Column({ name: "newsletter_id", type: "varchar", length: 64 })
  newsletterId!: string;

  @ManyToOne(() => NewsletterEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "newsletter_id" })
  newsletter!: NewsletterEntity;

  @Column({ name: "subscriber_member_id", type: "varchar", length: 64, nullable: true })
  subscriberMemberId!: string | null;

  @Index()
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

@Entity({ name: "tracking_events" })
@Index(["newsletterId"])
@Index(["occurredAt"])
export class TrackingEventEntity {
  @PrimaryColumn({ type: "varchar", length: 64 })
  id!: string;

  @Column({ name: "newsletter_id", type: "varchar", length: 64 })
  newsletterId!: string;

  @Column({ name: "recipient_id", type: "varchar", length: 64 })
  recipientId!: string;

  @Index()
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
