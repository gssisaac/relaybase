"use client";

import { ComplianceIdentityEditor } from "@/studio/components/ComplianceIdentityEditor";
import { NewsletterTemplateVariablesEditor } from "@/studio/components/newsletters/NewsletterTemplateVariablesEditor";
import type { TemplateVariablesSchema } from "@/studio/lib/layouts/layout-template-variables";
import type { CrmContentAssetOwner } from "@/lib/markdown-editor/utils/newsletter-upload";

export function NewsletterLogoFooterSection({
  newsletterId,
  assetOwner = "newsletter",
  logoFooterSchema,
  templateVariables,
  setTemplateVariables,
  editable,
  complianceOrganizationName,
  complianceIdentityId,
  accountDefaultComplianceIdentityId,
  onComplianceIdentityChange,
  onComplianceIdentitySaved,
}: {
  newsletterId: string;
  assetOwner?: CrmContentAssetOwner;
  logoFooterSchema: TemplateVariablesSchema | null;
  templateVariables: Record<string, string>;
  setTemplateVariables: (values: Record<string, string>) => void;
  editable: boolean;
  complianceOrganizationName?: string | null;
  complianceIdentityId: string | null;
  accountDefaultComplianceIdentityId: string | null;
  onComplianceIdentityChange: (id: string | null) => void | Promise<void>;
  onComplianceIdentitySaved?: () => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 px-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Logo
        </p>
        {logoFooterSchema?.fields.length ? (
          <NewsletterTemplateVariablesEditor
            newsletterId={newsletterId}
            assetOwner={assetOwner}
            schema={logoFooterSchema}
            values={templateVariables}
            onChange={setTemplateVariables}
            editable={editable}
            complianceOrganizationName={complianceOrganizationName}
            emptyMessage={null}
          />
        ) : (
          <p className="px-0.5 text-[11px] leading-snug text-muted-foreground">
            This layout has no logo slots — pick a branded template or import HTML with{" "}
            {`{{vars.brand.logo}}`}.
          </p>
        )}
      </div>

      <div>
        <p className="mb-2 px-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Footer
        </p>
        <div className="rounded-md border border-border bg-muted/20 p-2.5">
          <ComplianceIdentityEditor
            mode="newsletter"
            compact
            selectedIdentityId={complianceIdentityId}
            accountDefaultIdentityId={accountDefaultComplianceIdentityId}
            onSelectedIdentityIdChange={onComplianceIdentityChange}
            onIdentitySaved={() => onComplianceIdentitySaved?.()}
            description="Organization, postal address, and contact fill the compliance footer at send time — edit once, reused everywhere."
          />
        </div>
      </div>
    </div>
  );
}
