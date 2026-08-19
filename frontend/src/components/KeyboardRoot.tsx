import React from "react";

// Tooling fallback. Metro prefers KeyboardRoot.web.tsx / KeyboardRoot.native.tsx at bundle time.
export function KeyboardRoot({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
