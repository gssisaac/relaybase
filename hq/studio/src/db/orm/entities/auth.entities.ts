import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from "typeorm";

import { AccountLinkEntity } from "./tenant.entities";

@Entity({ name: "hq_auth_users" })
export class HqAuthUserEntity {
  @PrimaryColumn({ type: "varchar", length: 64 })
  id!: string;

  @Column({ name: "account_link_id", type: "varchar", length: 64 })
  accountLinkId!: string;

  @ManyToOne(() => AccountLinkEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "account_link_id" })
  accountLink!: AccountLinkEntity;

  @Index({ unique: true })
  @Column({ type: "varchar", length: 255 })
  email!: string;

  @Column({ name: "password_hash", type: "varchar", length: 512 })
  passwordHash!: string;

  @Column({ type: "varchar", length: 128, nullable: true })
  name!: string | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @Column({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}

@Entity({ name: "hq_refresh_tokens" })
export class HqRefreshTokenEntity {
  @PrimaryColumn({ type: "varchar", length: 64 })
  id!: string;

  @Index({ unique: true })
  @Column({ name: "token_hash", type: "varchar", length: 128 })
  tokenHash!: string;

  @Column({ name: "user_id", type: "varchar", length: 64 })
  userId!: string;

  @ManyToOne(() => HqAuthUserEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: HqAuthUserEntity;

  @Column({ name: "expires_at", type: "timestamptz" })
  expiresAt!: Date;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @Column({ name: "user_agent", type: "text", nullable: true })
  userAgent!: string | null;

  @Column({ type: "varchar", length: 64, nullable: true })
  ip!: string | null;
}

@Entity({ name: "hq_password_reset_tokens" })
export class HqPasswordResetTokenEntity {
  @PrimaryColumn({ type: "varchar", length: 64 })
  id!: string;

  @Index({ unique: true })
  @Column({ name: "token_hash", type: "varchar", length: 128 })
  tokenHash!: string;

  @Column({ name: "user_id", type: "varchar", length: 64 })
  userId!: string;

  @ManyToOne(() => HqAuthUserEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: HqAuthUserEntity;

  @Column({ name: "expires_at", type: "timestamptz" })
  expiresAt!: Date;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @Column({ type: "boolean", default: false })
  used!: boolean;
}
