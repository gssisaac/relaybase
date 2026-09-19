import { studioService } from "@services/studio-service";
import { accountDefaultComplianceIdentityId } from "@lib/compliance/identity";

export function serializeAccountLink() {
  const data = studioService.read();
  const account = data.account;
  return {
    id: account.id,
    workerUrl: account.workerUrl,
    domain: account.domain,
    sendApiKeyConfigured: Boolean(
      process.env.STUDIO_WORKER_SEND_API_KEY?.trim() || account.sendApiKey?.trim(),
    ),
    compliance: account.compliance,
    defaultComplianceIdentityId: accountDefaultComplianceIdentityId(data),
    createdAt: account.createdAt,
  };
}
