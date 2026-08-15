import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { storage } from "@/src/utils/storage";
import { api, Profile } from "@/src/api";

const ACTIVE_KEY = "aida.activeProfileId";
const PROFILE_CACHE_KEY = "aida.profileCache.v1";

type Ctx = {
  profiles: Profile[];
  activeProfile: Profile | null;
  activeId: string | null;
  loading: boolean;
  error: string | null;
  setActive: (id: string) => void;
  reload: () => Promise<void>;
  refreshTick: number;
  bumpRefresh: () => void;
};

const AppContext = createContext<Ctx>({
  profiles: [],
  activeProfile: null,
  activeId: null,
  loading: true,
  error: null,
  setActive: () => {},
  reload: async () => {},
  refreshTick: 0,
  bumpRefresh: () => {},
});

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  const load = useCallback(async () => {
    setError(null);

    let cachedProfiles: Profile[] = [];
    let storedActiveId = "";

    try {
      const [cachedRaw, stored] = await Promise.all([
        storage.getItem<string>(PROFILE_CACHE_KEY, ""),
        storage.getItem<string>(ACTIVE_KEY, ""),
      ]);

      storedActiveId = stored || "";

      if (cachedRaw) {
        const parsed = JSON.parse(cachedRaw) as Profile[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          cachedProfiles = parsed;
          setProfiles(parsed);
          const cachedActive = parsed.find((p) => p.id === storedActiveId);
          setActiveId(cachedActive?.id ?? parsed[0]?.id ?? null);
          // The UI can render immediately from cache while fresh data is fetched.
          setLoading(false);
        }
      }
    } catch {
      // Cache is an optimization only. A malformed/missing cache must never
      // prevent a normal network bootstrap.
    }

    if (cachedProfiles.length === 0) setLoading(true);

    try {
      let list = await api.listProfiles();

      // First launch creates only an identity shell. Medical fields stay empty
      // until the user explicitly enters data or connects a source.
      if (!list || list.length === 0) {
        const blank = await api.createProfile({
          name: "Мой профиль",
          kind: "me",
          allergies: [],
          chronic_conditions: [],
        });
        list = [blank];
      }

      setProfiles(list);
      const valid = list.find((p) => p.id === storedActiveId);
      const nextId = valid ? valid.id : list[0]?.id ?? null;
      setActiveId(nextId);
      setError(null);

      // Cache only serializable API data. Storage currently accepts primitives,
      // so the profile list is kept as a JSON string.
      void storage.setItem(PROFILE_CACHE_KEY, JSON.stringify(list));
    } catch (e: any) {
      // If cached data was already rendered, keep the app usable and surface
      // the error without throwing the user back into a blocking loading state.
      if (cachedProfiles.length === 0) {
        setError(e?.message || "Failed to load");
      } else {
        setError(e?.message || null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setActive = useCallback((id: string) => {
    setActiveId(id);
    storage.setItem(ACTIVE_KEY, id);
    setRefreshTick((t) => t + 1);
  }, []);

  const bumpRefresh = useCallback(() => setRefreshTick((t) => t + 1), []);

  const activeProfile = profiles.find((p) => p.id === activeId) ?? null;

  return (
    <AppContext.Provider
      value={{
        profiles,
        activeProfile,
        activeId,
        loading,
        error,
        setActive,
        reload: load,
        refreshTick,
        bumpRefresh,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);
