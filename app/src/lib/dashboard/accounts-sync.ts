/**
 * Cross-store signal: Dashboard AccountsStore (and Domain seed) → Email MailAccountsStore.
 * Stores must not import each other; providers subscribe here.
 */

export type AddressesChangedEvent = {
  domain?: string;
  emails?: string[];
};

type Listener = (event: AddressesChangedEvent) => void;

const listeners = new Set<Listener>();

export function notifyAddressesChanged(event: AddressesChangedEvent = {}) {
  for (const listener of listeners) {
    try {
      listener(event);
    } catch {
      // keep other listeners running
    }
  }
}

export function subscribeAddressesChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
