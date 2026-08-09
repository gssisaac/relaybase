"use client";

import { useEffect } from "react";

import { subscribeAddressesChanged } from "@/lib/dashboard/accounts-sync";
import { useProductId } from "@/lib/dashboard/shared/ProductContext";
import { clearEmailCache } from "@/email/components/email-cached-fetch";
import { useMailAccountsStore } from "@/email/components/MailAccountsContext";

/**
 * Wires Dashboard address mutations → Email MailAccountsStore.refresh.
 * Keeps the two stores separate; only this bridge couples them.
 */
export function AccountsSyncBridge() {
  const productId = useProductId();
  const mailAccounts = useMailAccountsStore();

  useEffect(() => {
    return subscribeAddressesChanged(() => {
      clearEmailCache(productId, "addresses:all");
      void mailAccounts.refreshAddresses();
    });
  }, [mailAccounts, productId]);

  return null;
}
