import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity({ name: "account_links" })
export class AccountLinkEntity {
  @PrimaryColumn({ type: "varchar", length: 64 })
  id!: string;

  @Column({ name: "worker_url", type: "varchar", length: 512, nullable: true })
  workerUrl!: string | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  domain!: string | null;

  @Column({ name: "send_api_key", type: "text", nullable: true })
  sendApiKey!: string | null;

  @Column({ name: "organization_name", type: "varchar", length: 255, nullable: true })
  organizationName!: string | null;

  @Column({ name: "postal_address", type: "text", nullable: true })
  postalAddress!: string | null;

  @Column({ name: "contact_email", type: "varchar", length: 255, nullable: true })
  contactEmail!: string | null;

  @Column({ name: "compliance_updated_at", type: "timestamptz", nullable: true })
  complianceUpdatedAt!: Date | null;

  @Column({ name: "default_compliance_identity_id", type: "varchar", length: 64, nullable: true })
  defaultComplianceIdentityId!: string | null;

  @OneToMany(() => ComplianceIdentityEntity, (row: ComplianceIdentityEntity) => row.accountLink)
  complianceIdentities!: ComplianceIdentityEntity[];

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}

@Entity({ name: "compliance_identities" })
export class ComplianceIdentityEntity {
  @PrimaryColumn({ type: "varchar", length: 64 })
  id!: string;

  @Column({ name: "account_link_id", type: "varchar", length: 64 })
  accountLinkId!: string;

  @ManyToOne(() => AccountLinkEntity, (account: AccountLinkEntity) => account.complianceIdentities, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "account_link_id" })
  accountLink!: AccountLinkEntity;

  @Column({ type: "varchar", length: 255 })
  name!: string;

  @Column({ name: "organization_name", type: "varchar", length: 255, nullable: true })
  organizationName!: string | null;

  @Column({ name: "postal_address", type: "text", nullable: true })
  postalAddress!: string | null;

  @Column({ name: "contact_email", type: "varchar", length: 255, nullable: true })
  contactEmail!: string | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
