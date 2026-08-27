import React from "react";
import { View } from "react-native";

import HomeEditorialPolished from "@/src/emergent/screens/HomeEditorialPolished";

export default function DesktopHomeAdapter() {
  return (
    <View style={{ flex: 1, width: "100%", alignItems: "center" }}>
      <View style={{ flex: 1, width: "100%", maxWidth: 860 }}>
        <HomeEditorialPolished />
      </View>
    </View>
  );
}
