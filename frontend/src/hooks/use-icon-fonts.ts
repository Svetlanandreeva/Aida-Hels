// Icon font loader for Expo apps.
//
// Expo Go on Android still uses CDN-hosted fonts because Metro can return
// zero-byte vector-icon assets in StoreClient. Web, however, must explicitly
// load the bundled icon font files before the app renders; otherwise glyphs
// fall back to empty squares. Native dev/prod builds keep using autolinking.
// ICON_VECTOR_VERSION must match @expo/vector-icons in package.json.

import Constants, { ExecutionEnvironment } from "expo-constants";
import { useFonts } from "expo-font";
import { Platform } from "react-native";
import {
  AntDesign,
  Entypo,
  EvilIcons,
  Feather,
  FontAwesome,
  FontAwesome5,
  FontAwesome6,
  Fontisto,
  Foundation,
  Ionicons,
  MaterialCommunityIcons,
  MaterialIcons,
  Octicons,
  SimpleLineIcons,
  Zocial,
} from "@expo/vector-icons";

const ICON_VECTOR_VERSION = "15.1.1";

// short internal fontName (what the library queries) -> CDN .ttf file name
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
    Object.entries(ICON_FAMILIES).map(([key, file]) => [key, cdnUrl(file)]),
  );

// On web use the package-bundled assets. This keeps icons available even when
// a CDN is blocked and, crucially, makes expo-font wait for them before render.
const bundledWebFonts = {
  ...AntDesign.font,
  ...Entypo.font,
  ...EvilIcons.font,
  ...Feather.font,
  ...FontAwesome.font,
  ...FontAwesome5.font,
  ...FontAwesome6.font,
  ...Fontisto.font,
  ...Foundation.font,
  ...Ionicons.font,
  ...MaterialCommunityIcons.font,
  ...MaterialIcons.font,
  ...Octicons.font,
  ...SimpleLineIcons.font,
  ...Zocial.font,
};

export const useIconFonts = (): readonly [boolean, Error | null] => {
  const sources =
    Platform.OS === "web"
      ? bundledWebFonts
      : Constants.executionEnvironment === ExecutionEnvironment.StoreClient
        ? cdnIconFontMap()
        : {};

  return useFonts(sources);
};
