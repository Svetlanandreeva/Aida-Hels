import React from "react";
import { Platform, useWindowDimensions } from "react-native";

import HomeEditorial from "@/src/emergent/screens/HomeEditorial";
import DesktopHomeAdapter from "@/src/emergent/screens/DesktopHomeAdapter";

export default function HomeRoute() {
  const { width } = useWindowDimensions();
  const desktop = Platform.OS === "web" && width >= 900;
  return desktop ? <DesktopHomeAdapter /> : <HomeEditorial />;
}
