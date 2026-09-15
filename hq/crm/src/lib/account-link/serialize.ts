import { store } from "../../db/store";

export function serializeAccountLink() {
  const account = store.read().account;
  return {
    id: account.id,
    workerUrl: account.workerUrl,
    domain: account.domain,
    compliance: account.compliance,
    createdAt: account.createdAt,
  };
}
