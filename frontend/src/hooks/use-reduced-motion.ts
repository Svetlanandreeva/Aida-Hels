import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

/**
 * Shared motion preference for functional UI animation.
 * Defaults to no animation until the OS preference is known, avoiding a flash
 * of motion for users who explicitly request reduced motion.
 */
export const useReducedMotion = () => {
  const [reduceMotion, setReduceMotion] = useState(true);

  useEffect(() => {
    let mounted = true;

    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (mounted) setReduceMotion(enabled);
      })
      .catch(() => {
        if (mounted) setReduceMotion(false);
      });

    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return reduceMotion;
};
