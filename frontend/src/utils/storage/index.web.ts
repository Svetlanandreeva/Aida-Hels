// Web storage (Metro picks index.ts on native).
// Helpers never throw: reads return `fallback`, writes return `false`.
// Values supported: string | number | boolean | null (JSON-serialized on disk).
// Usage: import { storage } from "@/src/utils/storage"; await storage.getItem(key, fallback);
// Browsers have no Keychain — secure* helpers reuse the same browser storage backend.
//
// New web reads/writes use localStorage so auth/profile bootstrap does not eagerly
// pull the AsyncStorage IndexedDB shim into the first JS path. Existing users are
// migrated lazily: on a localStorage miss we dynamically load AsyncStorage once,
// copy any legacy value into localStorage, then future boots stay on the fast path.

import { AssertNoExtras, StorageBase, StorageItemValue } from "./storage-base";

type WebStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

function browserStorage(): WebStorage | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

async function legacyGet(key: string): Promise<string | null> {
  try {
    const module = await import("@react-native-async-storage/async-storage");
    return await module.default.getItem(key);
  } catch {
    return null;
  }
}

async function legacyRemove(key: string): Promise<void> {
  try {
    const module = await import("@react-native-async-storage/async-storage");
    await module.default.removeItem(key);
  } catch {
    // Migration cleanup is best-effort only.
  }
}

export class Storage extends StorageBase {
  async getItem<Fallback extends StorageItemValue>(
    key: string,
    fallback: Fallback,
  ): Promise<Fallback | null> {
    try {
      const store = browserStorage();
      const current = store?.getItem(key) ?? null;
      if (current !== null) return this.retrieve(current, fallback);

      const legacy = await legacyGet(key);
      if (legacy === null) return fallback;
      try { store?.setItem(key, legacy); } catch {}
      return this.retrieve(legacy, fallback);
    } catch (e) {
      this.warn("getItem", key, e);
      return fallback;
    }
  }

  async setItem<Value extends StorageItemValue>(
    key: string,
    value: Value,
  ): Promise<boolean> {
    try {
      const store = browserStorage();
      if (!store) return false;
      store.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      this.warn("setItem", key, e);
      return false;
    }
  }

  async removeItem(key: string): Promise<boolean> {
    try {
      const store = browserStorage();
      store?.removeItem(key);
      void legacyRemove(key);
      return Boolean(store);
    } catch (e) {
      this.warn("removeItem", key, e);
      return false;
    }
  }

  async secureGet<Fallback extends StorageItemValue>(
    key: string,
    fallback: Fallback,
  ): Promise<Fallback | null> {
    return this.getItem(key, fallback);
  }

  async secureSet<Value extends StorageItemValue>(
    key: string,
    value: Value,
  ): Promise<boolean> {
    return this.setItem(key, value);
  }

  async secureRemove(key: string): Promise<boolean> {
    return this.removeItem(key);
  }
}

export const storage = new Storage();

// Compile-time guard: any new method must be declared in storage-base.ts first.
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- intentional compile-time-only assertion
type _NoExtras = AssertNoExtras<Exclude<keyof Storage, keyof StorageBase>>;