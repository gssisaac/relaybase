import { newToken } from "../shared/ids";
import type { TriggerPurpose, TriggerSource } from "../../db/types";

export function defaultTriggerForPurpose(purpose: TriggerPurpose): TriggerSource {
  if (purpose === "transactional") {
    return {
      type: "internal_event",
      event: "account.verify_email",
    };
  }
  return {
    type: "form_submit",
    formKey: "contact",
    emailPath: "email",
    namePath: "name",
    requiredFields: ["message"],
  };
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
