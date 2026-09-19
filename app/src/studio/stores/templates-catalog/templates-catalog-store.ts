"use client";

import { makeAutoObservable, runInAction } from "mobx";

import { studioApi, type StudioLayout, type StudioTemplate } from "@/studio/api";
import { newslettersHubStore } from "@/studio/stores/newsletters-hub";

export class TemplatesCatalogStore {
  templates: StudioTemplate[] = [];
  layouts: StudioLayout[] = [];

  catalogFetching = false;

  private catalogFetchPromise: Promise<void> | null = null;

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  get catalogShowPlaceholder(): boolean {
    return this.templates.length === 0 && this.catalogFetching;
  }

  get catalogRefreshing(): boolean {
    return this.templates.length > 0 && this.catalogFetching;
  }

  /** Layout rows for thumbnails — local cache or newsletters hub session cache. */
  get resolvedLayouts(): StudioLayout[] {
    if (this.layouts.length > 0) return this.layouts;
    return newslettersHubStore.layouts;
  }

  getTemplate(id: string): StudioTemplate | undefined {
    return this.templates.find((row) => row.id === id);
  }

  private syncLayoutsFromHub() {
    if (this.layouts.length > 0) return;
    if (newslettersHubStore.layouts.length > 0) {
      this.layouts = newslettersHubStore.layouts;
    }
  }

  ensureCatalogLoaded() {
    this.syncLayoutsFromHub();
    if (this.templates.length > 0) return;
    void this.refreshCatalog();
  }

  async refreshCatalog(options?: { force?: boolean }): Promise<void> {
    if (this.catalogFetchPromise) return this.catalogFetchPromise;

    const hasCache = this.templates.length > 0;
    if (!options?.force && hasCache) {
      this.syncLayoutsFromHub();
      return Promise.resolve();
    }

    if (!options?.force && !hasCache && this.catalogFetching) {
      return this.catalogFetchPromise ?? Promise.resolve();
    }

    this.catalogFetching = true;
    this.catalogFetchPromise = (async () => {
      try {
        this.syncLayoutsFromHub();
        const needLayouts = this.layouts.length === 0;
        const [templateRes, layoutRes] = await Promise.all([
          studioApi.listTemplates(),
          needLayouts ? studioApi.listLayouts() : Promise.resolve({ layouts: this.layouts }),
        ]);
        runInAction(() => {
          this.templates = templateRes.templates;
          if (needLayouts) {
            this.layouts = layoutRes.layouts;
            if (layoutRes.layouts.length > 0) {
              newslettersHubStore.setLayouts(layoutRes.layouts);
            }
          }
        });
      } catch {
        throw new Error("Could not load templates");
      } finally {
        runInAction(() => {
          this.catalogFetching = false;
          this.catalogFetchPromise = null;
        });
      }
    })();

    return this.catalogFetchPromise;
  }
}

/** Session cache — survives remounts when reopening template pickers. */
export const templatesCatalogStore = new TemplatesCatalogStore();
