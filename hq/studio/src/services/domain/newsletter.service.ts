import type { Newsletter } from "@db/types";
import { mutateStudioDocument } from "@services/studio/studio-document.service";
import { newsletterFromEntity, newsletterToEntity } from "@services/domain/newsletter.mapper";
import { studioRepos } from "@services/repositories";

export const newsletterService = {
  async findById(accountLinkId: string, id: string): Promise<Newsletter | null> {
    const row = await studioRepos.newsletter().findOne({ where: { id, accountLinkId } });
    return row ? newsletterFromEntity(row) : null;
  },

  async listForAccount(accountLinkId: string): Promise<Newsletter[]> {
    const rows = await studioRepos.newsletter().find({ where: { accountLinkId } });
    return rows.map(newsletterFromEntity);
  },

  async save(newsletter: Newsletter): Promise<Newsletter> {
    const saved = await studioRepos.newsletter().save(newsletterToEntity(newsletter));
    const row = newsletterFromEntity(saved);
    mutateStudioDocument((draft) => {
      const idx = draft.newsletters.findIndex((n) => n.id === row.id);
      if (idx >= 0) draft.newsletters[idx] = row;
      else draft.newsletters.push(row);
    });
    return row;
  },

  async deleteById(id: string): Promise<void> {
    await studioRepos.newsletter().delete({ id });
    mutateStudioDocument((draft) => {
      draft.newsletters = draft.newsletters.filter((n) => n.id !== id);
    });
  },
};
