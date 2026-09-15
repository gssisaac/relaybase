import { store } from "../../db/store";
import { accountDefaultComplianceIdentityId } from "../compliance/identity";

export function serializeAccountLink() {
  const data = store.read();
  const account = data.account;
  return {
    id: account.id,
    workerUrl: account.workerUrl,
    domain: account.domain,
    sendApiKeyConfigured: Boolean(
      process.env.CRM_WORKER_SEND_API_KEY?.trim() || account.sendApiKey?.trim(),
    ),
    compliance: account.compliance,
    defaultComplianceIdentityId: accountDefaultComplianceIdentityId(data),
    createdAt: account.createdAt,
  };
}
