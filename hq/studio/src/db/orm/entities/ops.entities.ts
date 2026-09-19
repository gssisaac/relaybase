import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from "typeorm";

import { AccountLinkEntity } from "./tenant.entities";

@Entity({ name: "account_suppressions" })
@Index(["accountLinkId", "email"])
export class AccountSuppressionEntity {
  @PrimaryColumn({ type: "varchar", length: 64 })
  id!: string;

  @Column({ name: "account_link_id", type: "varchar", length: 64 })
  accountLinkId!: string;

  @ManyToOne(() => AccountLinkEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "account_link_id" })
  accountLink!: AccountLinkEntity;

  @Column({ type: "varchar", length: 255 })
  email!: string;

  @Column({ type: "varchar", length: 64 })
  reason!: string;

  @Column({ name: "subscriber_group_id", type: "varchar", length: 64, nullable: true })
  subscriberGroupId!: string | null;

  @Column({ name: "source_newsletter_id", type: "varchar", length: 64, nullable: true })
  sourceNewsletterId!: string | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;
}

@Entity({ name: "scheduled_jobs" })
@Index(["runAt", "status"])
export class ScheduledJobEntity {
  @PrimaryColumn({ type: "varchar", length: 64 })
  id!: string;

  @Column({ name: "account_link_id", type: "varchar", length: 64 })
  accountLinkId!: string;

  @Column({ type: "varchar", length: 64 })
  kind!: string;

  @Index()
  @Column({ name: "ref_id", type: "varchar", length: 64 })
  refId!: string;

  @Column({ name: "run_at", type: "timestamptz" })
  runAt!: Date;

  @Column({ type: "varchar", length: 32, default: "pending" })
  status!: string;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;
}

@Entity({ name: "pipeline_cards" })
@Index(["accountLinkId", "stage"])
export class PipelineCardEntity {
  @PrimaryColumn({ type: "varchar", length: 64 })
  id!: string;

  @Column({ name: "account_link_id", type: "varchar", length: 64 })
  accountLinkId!: string;

  @Index()
  @Column({ name: "member_email", type: "varchar", length: 255 })
  memberEmail!: string;

  @Column({ name: "member_name", type: "varchar", length: 255, nullable: true })
  memberName!: string | null;

  @Column({ type: "varchar", length: 64 })
  stage!: string;

  @Column({ type: "text", nullable: true })
  note!: string | null;

  @Column({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}

@Entity({ name: "activities" })
@Index(["accountLinkId", "memberEmail"])
export class ActivityEntity {
  @PrimaryColumn({ type: "varchar", length: 64 })
  id!: string;

  @Column({ name: "account_link_id", type: "varchar", length: 64 })
  accountLinkId!: string;

  @Column({ name: "member_email", type: "varchar", length: 255 })
  memberEmail!: string;

  @Column({ type: "varchar", length: 64 })
  type!: string;

  @Column({ type: "jsonb", default: {} })
  payload!: unknown;

  @Column({ name: "occurred_at", type: "timestamptz" })
  occurredAt!: Date;
}
