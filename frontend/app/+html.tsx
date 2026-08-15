// @ts-nocheck
import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en" style={{ height: "100%" }}>
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover"
        />
        <ScrollViewStyleReset />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              html, body, body > div:first-child {
                width: 100%;
                min-height: 100%;
                min-height: 100dvh;
              }
              body > div:first-child {
                position: fixed !important;
                inset: 0;
                height: 100dvh;
                max-height: 100dvh;
              }
              [role="tablist"] {
                padding-bottom: env(safe-area-inset-bottom) !important;
              }
              [role="tablist"] [role="tab"] * { overflow: visible !important; }
              [role="heading"], [role="heading"] * { overflow: visible !important; }
              [data-testid="log-data-button"] { display: none !important; }
            `,
          }}
        />
      </head>
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          height: "100dvh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {children}
      </body>
    </html>
  );
}
