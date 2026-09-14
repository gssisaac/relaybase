import type { EditContext, PersistAdapter } from "./types";

export type CampaignDraftSnapshot = {
  subject: string;
  bodyMarkdown: string;
  templateId: string;
};

export type CampaignPersistBridge = {
  getDraft: () => CampaignDraftSnapshot;
  setBodyMarkdown: (body: string) => void;
  getLastPersistedBody: () => string | null;
  persist: () => Promise<void>;
};

export function createCampaignPersistAdapter(bridge: CampaignPersistBridge): PersistAdapter {
  return {
    ingest(ctx: EditContext, content: string): void {
      if (!ctx.path) return;
      bridge.setBodyMarkdown(content);
    },

    async flush(ctx: EditContext, content?: string): Promise<void> {
      if (!ctx.path) return;
      if (content != null) bridge.setBodyMarkdown(content);
      await bridge.persist();
    },

    isDirty(ctx: EditContext): boolean {
      if (!ctx.path) return false;
      const persisted = bridge.getLastPersistedBody();
      const current = bridge.getDraft().bodyMarkdown;
      if (persisted == null) return current.trim() !== "";
      return persisted !== current;
    },

    getCachedContent(ctx: EditContext): string | null {
      if (!ctx.path) return null;
      return bridge.getDraft().bodyMarkdown;
    },

    getPersistedContent(ctx: EditContext): string | null {
      if (!ctx.path) return null;
      return bridge.getLastPersistedBody();
    },
  };
}
