import type { Layout, Template } from "@db/types";
import { templateCatalogStore } from "@services/template/catalog-store";
import { getBuiltinTemplates } from "@services/template/builtin-templates";
import {
  canAccessCustomLayout,
  layoutReferencedByMessages,
  nextCustomForkName,
} from "@services/template/layout-access";
import { serializeLayout } from "@services/template/layout-serialize";
import { prepareTemplateImport } from "@services/template/prepare-import";
import { readDefaultBrandLogoPng } from "@services/template/read-brand-logo-png";
import {
  resolveTemplateVariableDefaults,
  sanitizeTemplateVariables,
} from "@services/template/variable-schema";
import { studioDocumentService } from "@services/studio/service";

export class TemplateService {
  private static instance: TemplateService;

  static getInstance(): TemplateService {
    if (!TemplateService.instance) {
      TemplateService.instance = new TemplateService();
    }
    return TemplateService.instance;
  }

  listCatalogTemplates(): Template[] {
    return templateCatalogStore.listAll();
  }

  /** Alias for catalog list (routes legacy `templateCatalogStore.listAll`). */
  listAll(): Template[] {
    return this.listCatalogTemplates();
  }

  getCatalogTemplate(id: string): Template | undefined {
    return templateCatalogStore.findById(id);
  }

  findById(id: string): Template | undefined {
    return this.getCatalogTemplate(id);
  }

  getBuiltinLayouts() {
    return getBuiltinTemplates();
  }

  readDocumentLayouts(): Layout[] {
    return studioDocumentService.read().layouts;
  }

  sanitizeVariables(input: Parameters<typeof sanitizeTemplateVariables>[0]) {
    return sanitizeTemplateVariables(input);
  }

  resolveVariableDefaults(input: Parameters<typeof resolveTemplateVariableDefaults>[0]) {
    return resolveTemplateVariableDefaults(input);
  }

  readDefaultBrandLogoPng() {
    return readDefaultBrandLogoPng();
  }

  readDocument() {
    return studioDocumentService.read();
  }

  mutateDocument(mutator: Parameters<typeof studioDocumentService.mutate>[0]) {
    return studioDocumentService.mutate(mutator);
  }

  canAccessCustomLayout(row: Layout): boolean {
    return canAccessCustomLayout(row);
  }

  layoutReferencedByMessages(layoutId: string): boolean {
    return layoutReferencedByMessages(layoutId);
  }

  nextCustomForkName(layouts: Layout[], baseName: string): string {
    return nextCustomForkName(layouts, baseName);
  }

  serializeLayout(row: Layout) {
    return serializeLayout(row);
  }

  prepareImport(input: Parameters<typeof prepareTemplateImport>[0]) {
    return prepareTemplateImport(input);
  }

  saveLayoutInDocument(layout: Layout): void {
    studioDocumentService.mutate((draft) => {
      const idx = draft.layouts.findIndex((l) => l.id === layout.id);
      if (idx >= 0) draft.layouts[idx] = layout;
      else draft.layouts.push(layout);
    });
  }
}

export const templateService = TemplateService.getInstance();
