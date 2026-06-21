import type { Env } from "./env";
import app from "./app";
import { handleInboundEmail } from "./inbound";

export default {
  fetch: app.fetch,
  async email(
    message: ForwardableEmailMessage,
    env: Env,
  ): Promise<void> {
    try {
      await handleInboundEmail(message, env);
    } catch (error) {
      console.error("Failed to store inbound email", error);
      throw error;
    }
  },
} satisfies ExportedHandler<Env>;
