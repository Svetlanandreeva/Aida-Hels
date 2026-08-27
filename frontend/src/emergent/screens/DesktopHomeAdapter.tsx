import React from "react";
import { View } from "react-native";

import Home from "@/src/emergent/screens/Home";

export default function DesktopHomeAdapter() {
  return (
    <View style={{ flex: 1, width: "100%", alignItems: "center" }}>
      <View style={{ flex: 1, width: "100%", maxWidth: 1180 }}>
        <Home />
      </View>
    </View>
  );
}
