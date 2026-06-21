import type { CapacitorConfig } from "@capacitor/cli";

const serverUrl = process.env.CAP_SERVER_URL?.trim();

const config: CapacitorConfig = {
  appId: "com.ochiga.oyifacility",
  appName: "Oyi Facility",
  // Facility uses authenticated Next routes and dynamic home detail pages. Native
  // builds therefore load the HTTPS release host instead of an unsafe static export.
  webDir: "native-shell",
  ...(serverUrl
    ? {
        server: {
          url: serverUrl,
          cleartext: serverUrl.startsWith("http://"),
        },
      }
    : {}),
};

export default config;
