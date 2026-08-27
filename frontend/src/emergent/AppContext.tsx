import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";
import * as Haptics from "expo-haptics";

import { palette, ThemeColors } from "@/src/emergent/tokens";
import { translations, Lang, Dict } from "@/src/emergent/translations";
import { storage } from "@/src/utils/storage";

type ThemeName = "light" | "dark";

type AppContextValue = {
  theme: ThemeName;
  colors: ThemeColors;
  toggleTheme: () => void;
  lang: Lang;
  toggleLang: () => void;
  t: Dict;
};

const AppContext = createContext<AppContextValue | undefined>(undefined);

const THEME_KEY = "aida.theme";
const LANG_KEY = "aida.lang";

export function AppProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [theme, setTheme] = useState<ThemeName>(system === "dark" ? "dark" : "light");
  const [lang, setLang] = useState<Lang>("ru");

  useEffect(() => {
    (async () => {
      const savedTheme = await storage.getItem<ThemeName>(THEME_KEY, (system === "dark" ? "dark" : "light"));
      const savedLang = await storage.getItem<Lang>(LANG_KEY, "ru");
      if (savedTheme) setTheme(savedTheme);
      if (savedLang) setLang(savedLang);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleTheme = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTheme((prev) => {
      const next = prev === "light" ? "dark" : "light";
      storage.setItem(THEME_KEY, next);
      return next;
    });
  };

  const toggleLang = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLang((prev) => {
      const next = prev === "ru" ? "en" : "ru";
      storage.setItem(LANG_KEY, next);
      return next;
    });
  };

  const value = useMemo<AppContextValue>(() => {
    const base = translations[lang];
    const t: Dict = {
      ...base,
      common: {
        ...base.common,
        tryDemo: base.common.login,
      },
    };
    return {
      theme,
      colors: palette[theme],
      toggleTheme,
      lang,
      toggleLang,
      t,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme, lang]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}

