// Web storage (Metro picks index.ts on native).
// Helpers never throw: reads return `fallback`, writes return `false`.
// Values supported: string | number | boolean | null (JSON-serialized on disk).
// Usage: import { storage } from "@/src/utils/storage"; await storage.getItem(key, fallback);
// Browsers have no Keychain — secure* helpers reuse the same browser storage backend.
//
// New web reads/writes use localStorage so auth/profile bootstrap does not eagerly
// pull the AsyncStorage IndexedDB shim into the first JS path. Existing users are
// migrated lazily on the first miss for each key. A per-key migration marker makes
// subsequent misses stay on the fast localStorage path instead of re-importing the
// legacy IndexedDB shim on every anonymous/cold startup.

import { AssertNoExtras, StorageBase, StorageItemValue } from "./storage-base";

type WebStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

const LEGACY_MIGRATION_MARKER_PREFIX = "aida.storage.legacyChecked:";

function legacyMarkerKey(key: string): string {
  return `${LEGACY_MIGRATION_MARKER_PREFIX}${key}`;
}

function browserStorage(): WebStorage | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

async function legacyGet(key: string): Promise<string | null | undefined> {
  try {
    const module = await import("@react-native-async-storage/async-storage");
    try {
      return await module.default.getItem(key);
    } catch {
      return undefined;
    }
  } catch {
    return undefined;
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

      const marker = legacyMarkerKey(key);
      if (store?.getItem(marker) === "1") return fallback;

      const legacy = await legacyGet(key);
      if (legacy === undefined) return fallback;

      try {
        if (legacy !== null) store?.setItem(key, legacy);
        store?.setItem(marker, "1");
      } catch {}

      if (legacy === null) return fallback;
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
      store.setItem(legacyMarkerKey(key), "1");
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
      // Mark the legacy key as handled before best-effort cleanup so an immediate
      // follow-up read cannot resurrect a just-removed session/value from IndexedDB.
      store?.setItem(legacyMarkerKey(key), "1");
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
