// Icon font loader for Expo apps.
//
// Expo Go on Android and the static web build load vector-icon fonts from the
// pinned CDN. On web, only the font used by the public/auth shell (Ionicons)
// is requested during bootstrap; the rest are deferred until the browser is
// idle so first paint is not competing with a pile of font downloads.
// Native Expo Go keeps the previous eager behavior because those screens may
// need any family immediately. Native dev/prod builds keep using autolinking.
// ICON_VECTOR_VERSION must match @expo/vector-icons in package.json.

import Constants, { ExecutionEnvironment } from "expo-constants";
import * as Font from "expo-font";
import { useFonts } from "expo-font";
import { useEffect } from "react";
import { Platform } from "react-native";

const ICON_VECTOR_VERSION = "15.1.1";

// Internal font-family name -> CDN .ttf file name.
const ICON_FAMILIES: Record<string, string> = {
  anticon: "AntDesign",
  entypo: "Entypo",
  evilicons: "EvilIcons",
  feather: "Feather",
  FontAwesome: "FontAwesome",
  Fontisto: "Fontisto",
  foundation: "Foundation",
  ionicons: "Ionicons",
  "material-community": "MaterialCommunityIcons",
  material: "MaterialIcons",
  octicons: "Octicons",
  "simple-line-icons": "SimpleLineIcons",
  zocial: "Zocial",
  "FontAwesome5Free-Regular": "FontAwesome5_Regular",
  "FontAwesome5Free-Solid": "FontAwesome5_Solid",
  "FontAwesome5Free-Brand": "FontAwesome5_Brands",
  "FontAwesome6Free-Regular": "FontAwesome6_Regular",
  "FontAwesome6Free-Solid": "FontAwesome6_Solid",
  "FontAwesome6Free-Brand": "FontAwesome6_Brands",
};

const cdnUrl = (file: string): string =>
  `https://cdn.jsdelivr.net/npm/@expo/vector-icons@${ICON_VECTOR_VERSION}/build/vendor/react-native-vector-icons/Fonts/${file}.ttf`;

const cdnIconFontMap = (): Record<string, string> =>
  Object.fromEntries(
    Object.entries(ICON_FAMILIES).map(([family, file]) => [family, cdnUrl(file)]),
  );

const WEB_CRITICAL_ICON_FONTS: Record<string, string> = {
  ionicons: cdnUrl("Ionicons"),
};

const WEB_DEFERRED_ICON_FONTS: Record<string, string> = Object.fromEntries(
  Object.entries(ICON_FAMILIES)
    .filter(([family]) => family !== "ionicons")
    .map(([family, file]) => [family, cdnUrl(file)]),
);

function scheduleWhenIdle(task: () => void): () => void {
  const root = globalThis as any;
  if (typeof root.requestIdleCallback === "function") {
    const id = root.requestIdleCallback(task, { timeout: 1800 });
    return () => root.cancelIdleCallback?.(id);
  }
  const id = setTimeout(task, 700);
  return () => clearTimeout(id);
}

export const useIconFonts = (): readonly [boolean, Error | null] => {
  const isWeb = Platform.OS === "web";
  const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

  const [loaded, error] = useFonts(
    isWeb ? WEB_CRITICAL_ICON_FONTS : isExpoGo ? cdnIconFontMap() : {},
  );

  useEffect(() => {
    if (!isWeb || !loaded) return;
    return scheduleWhenIdle(() => {
      void Font.loadAsync(WEB_DEFERRED_ICON_FONTS).catch(() => undefined);
    });
  }, [isWeb, loaded]);

  return [loaded, error] as const;
};
