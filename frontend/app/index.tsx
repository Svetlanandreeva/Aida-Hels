import React from "react";
import { useWindowDimensions } from "react-native";

import Landing from "@/src/emergent/screens/Landing";
import LandingDesktop from "@/src/emergent/screens/LandingDesktop";

export default function Index() {
  const { width } = useWindowDimensions();
  return width >= 1024 ? <LandingDesktop /> : <Landing />;
}
