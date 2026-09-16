import { newToken } from "../shared/ids";
import type { TriggerPurpose, TriggerSource } from "../../db/types";

export function defaultTriggerForPurpose(_purpose?: TriggerPurpose): TriggerSource {
  return defaultHttpWebhookTrigger();
}

export function defaultHttpWebhookTrigger(): TriggerSource {
  return {
    type: "http_webhook",
    secret: newToken(),
    emailPath: "email",
    namePath: "name",
    requiredFields: [],
  };
}
