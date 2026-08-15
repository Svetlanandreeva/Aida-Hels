// Icon font loader for Expo apps.
//
// Expo Go on Android and the static web build both load the vector-icon fonts
// from the pinned CDN. This avoids a production-web issue where the bundled
// .ttf files are exported but the browser still renders missing-glyph squares.
// Native dev/prod builds keep using autolinking.
// ICON_VECTOR_VERSION must match @expo/vector-icons in package.json.

import Constants, { ExecutionEnvironment } from "expo-constants";
import { useFonts } from "expo-font";
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

export const useIconFonts = (): readonly [boolean, Error | null] => {
  const shouldLoadFromCdn =
    Platform.OS === "web" ||
    Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

  return useFonts(shouldLoadFromCdn ? cdnIconFontMap() : {});
};
