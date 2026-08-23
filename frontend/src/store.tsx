import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { storage } from "@/src/utils/storage";
import { api, Profile, setProfileCacheAccountId } from "@/src/api";
import { withTimeout } from "@/src/async";
import { useAuth } from "@/src/auth";

const ACTIVE_KEY = "aida.activeProfileId";
const PROFILE_CACHE_KEY = "aida.profileCache.v1";
const PROFILE_BOOTSTRAP_TIMEOUT_MS = 3500;

const PREVIEW_PROFILE: Profile = {
  id: "preview-profile",
  name: "Предпросмотр",
  kind: "me",
  allergies: [],
  chronic_conditions: [],
  module_settings: {},
  goals: [],
  onboarding_completed: true,
};

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
  profiles: [], activeProfile: null, activeId: null, loading: true, error: null,
  setActive: () => {}, reload: async () => {}, refreshTick: 0, bumpRefresh: () => {},
});

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { preview, account } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  const load = useCallback(async () => {
    setError(null);
    if (preview) {
      setProfileCacheAccountId(null);
      setProfiles([PREVIEW_PROFILE]);
      setActiveId(PREVIEW_PROFILE.id);
      setLoading(false);
      return;
    }

    if (!account?.id) {
      setProfileCacheAccountId(null);
      setProfiles([]);
      setActiveId(null);
      setLoading(false);
      return;
    }

    setProfileCacheAccountId(account.id);
    const profileCacheKey = `${PROFILE_CACHE_KEY}.${account.id}`;
    const activeKey = `${ACTIVE_KEY}.${account.id}`;

    let cachedProfiles: Profile[] = [];
    let storedActiveId = "";
    try {
      const [cachedRaw, stored] = await Promise.all([
        storage.getItem<string>(profileCacheKey, ""),
        storage.getItem<string>(activeKey, ""),
      ]);
      storedActiveId = stored || "";
      if (cachedRaw) {
        const parsed = JSON.parse(cachedRaw) as Profile[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          cachedProfiles = parsed;
          setProfiles(parsed);
          const cachedActive = parsed.find((p) => p.id === storedActiveId);
          setActiveId(cachedActive?.id ?? parsed[0]?.id ?? null);
          setLoading(false);
        }
      }
    } catch {}

    if (cachedProfiles.length === 0) setLoading(true);
    try {
      let list = await withTimeout(api.listProfiles(), PROFILE_BOOTSTRAP_TIMEOUT_MS, "profiles_list");
      if (!list || list.length === 0) {
        const blank = await withTimeout(
          api.createProfile({ name: "Мой профиль", kind: "me", allergies: [], chronic_conditions: [] }),
          PROFILE_BOOTSTRAP_TIMEOUT_MS,
          "profile_create",
        );
        list = [blank];
      }
      setProfiles(list);
      const valid = list.find((p) => p.id === storedActiveId);
      const nextId = valid ? valid.id : list[0]?.id ?? null;
      setActiveId(nextId);
      void storage.setItem(profileCacheKey, JSON.stringify(list));
    } catch (e: any) {
      // Keep usable cached state when refresh is slow/offline instead of replacing
      // the whole app with a spinner. Only surface an error when no cache exists.
      if (cachedProfiles.length === 0) setError(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [account?.id, preview]);

  useEffect(() => { load(); }, [load]);

  const setActive = useCallback((id: string) => {
    setActiveId(id);
    if (!preview && account?.id) storage.setItem(`${ACTIVE_KEY}.${account.id}`, id);
    setRefreshTick((t) => t + 1);
  }, [account?.id, preview]);

  const bumpRefresh = useCallback(() => setRefreshTick((t) => t + 1), []);
  const activeProfile = profiles.find((p) => p.id === activeId) ?? null;

  return <AppContext.Provider value={{ profiles, activeProfile, activeId, loading, error, setActive, reload: load, refreshTick, bumpRefresh }}>{children}</AppContext.Provider>;
};

export const useApp = () => useContext(AppContext);
