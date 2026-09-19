import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from "typeorm";

import { AccountLinkEntity } from "@db/entities/tenant.entities";

@Entity({ name: "layouts" })
export class LayoutEntity {
  @PrimaryColumn({ type: "varchar", length: 64 })
  id!: string;

  @Column({ name: "account_link_id", type: "varchar", length: 64, nullable: true })
  accountLinkId!: string | null;

  @Column({ type: "varchar", length: 255 })
  name!: string;

  @Column({ name: "html_source", type: "text" })
  htmlSource!: string;

  @Column({ name: "variables_schema", type: "jsonb", nullable: true })
  variablesSchema!: Record<string, unknown> | null;

  @Column({ name: "is_builtin", type: "boolean", default: false })
  isBuiltin!: boolean;

  @Column({ name: "derived_from_layout_id", type: "varchar", length: 64, nullable: true })
  derivedFromLayoutId!: string | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;
}

@Entity({ name: "templates" })
export class TemplateEntity {
  @PrimaryColumn({ type: "varchar", length: 64 })
  id!: string;

  @Column({ type: "varchar", length: 255 })
  name!: string;

  @Column({ type: "text", nullable: true })
  description!: string | null;

  @Column({ type: "varchar", length: 500 })
  subject!: string;

  @Column({ name: "preview_text", type: "text", nullable: true })
  previewText!: string | null;

  @Column({ name: "body_markdown", type: "text" })
  bodyMarkdown!: string;

  @Column({ name: "layout_id", type: "varchar", length: 64 })
  layoutId!: string;

  @Column({ name: "template_variables", type: "jsonb", default: {} })
  templateVariables!: Record<string, string>;

  @Column({ type: "varchar", length: 32, nullable: true })
  category!: string | null;

  @Column({ name: "is_builtin", type: "boolean", default: true })
  isBuiltin!: boolean;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}

@Entity({ name: "messages" })
export class MessageEntity {
  @PrimaryColumn({ type: "varchar", length: 64 })
  id!: string;

  @Column({ name: "account_link_id", type: "varchar", length: 64 })
  accountLinkId!: string;

  @ManyToOne(() => AccountLinkEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "account_link_id" })
  accountLink!: AccountLinkEntity;

  @Column({ type: "varchar", length: 255 })
  name!: string;

  @Column({ type: "varchar", length: 500 })
  subject!: string;

  @Column({ name: "preview_text", type: "text", nullable: true })
  previewText!: string | null;

  @Column({ name: "body_markdown", type: "text" })
  bodyMarkdown!: string;

  @Column({ name: "layout_id", type: "varchar", length: 64, nullable: true })
  layoutId!: string | null;

  @Column({ name: "template_variables", type: "jsonb", default: {} })
  templateVariables!: Record<string, string>;

  @Column({ name: "forked_from_template_id", type: "varchar", length: 64, nullable: true })
  forkedFromTemplateId!: string | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}

@Entity({ name: "message_assets" })
export class MessageAssetEntity {
  @PrimaryColumn({ type: "varchar", length: 64 })
  id!: string;

  @Column({ type: "varchar", length: 512, unique: true })
  key!: string;

  @Column({ name: "message_id", type: "varchar", length: 64 })
  messageId!: string;

  @Column({ type: "varchar", length: 255 })
  filename!: string;

  @Column({ name: "mime_type", type: "varchar", length: 128 })
  mimeType!: string;

  @Column({ name: "content_base64", type: "text" })
  contentBase64!: string;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;
}

@Entity({ name: "newsletter_assets" })
export class NewsletterAssetEntity {
  @PrimaryColumn({ type: "varchar", length: 64 })
  id!: string;

  @Column({ type: "varchar", length: 512, unique: true })
  key!: string;

  @Column({ name: "newsletter_id", type: "varchar", length: 64 })
  newsletterId!: string;

  @Column({ type: "varchar", length: 255 })
  filename!: string;

  @Column({ name: "mime_type", type: "varchar", length: 128 })
  mimeType!: string;

  @Column({ name: "content_base64", type: "text" })
  contentBase64!: string;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;
}

@Entity({ name: "trigger_assets" })
export class TriggerAssetEntity {
  @PrimaryColumn({ type: "varchar", length: 64 })
  id!: string;

  @Column({ type: "varchar", length: 512, unique: true })
  key!: string;

  @Column({ name: "trigger_id", type: "varchar", length: 64 })
  triggerId!: string;

  @Column({ type: "varchar", length: 255 })
  filename!: string;

  @Column({ name: "mime_type", type: "varchar", length: 128 })
  mimeType!: string;

  @Column({ name: "content_base64", type: "text" })
  contentBase64!: string;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;
}
