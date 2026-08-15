import React from "react";
import { StyleProp, View, ViewStyle } from "react-native";
import { useResponsiveLayout } from "@/src/hooks/use-responsive-layout";

export const ResponsiveScreen: React.FC<{
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}> = ({ children, style }) => {
  const responsive = useResponsiveLayout();

  return (
    <View
      style={[
        {
          width: "100%",
          minWidth: 0,
          alignSelf: "center",
          paddingHorizontal: responsive.contentPadding,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
};
