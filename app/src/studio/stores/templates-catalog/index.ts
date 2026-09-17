"use client";

import * as React from "react";
import { reaction } from "mobx";

import {
  TemplatesCatalogStore,
  templatesCatalogStore,
} from "./templates-catalog-store";

export { TemplatesCatalogStore, templatesCatalogStore } from "./templates-catalog-store";

/** MobX subscription for React re-renders (singleton store). */
export function useTemplatesCatalog(): TemplatesCatalogStore {
  const [, setTick] = React.useState(0);

  React.useEffect(() => {
    return reaction(
      () => ({
        templates: templatesCatalogStore.templates,
        layouts: templatesCatalogStore.layouts,
        catalogFetching: templatesCatalogStore.catalogFetching,
        catalogShowPlaceholder: templatesCatalogStore.catalogShowPlaceholder,
        catalogRefreshing: templatesCatalogStore.catalogRefreshing,
      }),
      () => setTick((t) => t + 1),
    );
  }, []);

  return templatesCatalogStore;
}
