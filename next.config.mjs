import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: __dirname,
  distDir: process.env.NEXT_BUILD_DIR || ".next",
  // Lint runs through the deterministic npm script; the installed legacy Next
  // ESLint dependency chain is incomplete and must not make production builds interactive.
  eslint: { ignoreDuringBuilds: true },
  typescript: { tsconfigPath: "./tsconfig.next.json" },
  // oyi-twin-engine is a locally file:-installed source package (symlinked
  // into node_modules, not prebuilt) — Next only transpiles workspace/local
  // packages that are explicitly listed here.
  transpilePackages: ["oyi-twin-engine"],
  webpack: (config, { isServer }) => {
    // oyi-twin-engine keeps its own node_modules so it still runs as a
    // standalone app — without this, its source resolves react/three/r3f
    // from ITS copies instead of ours, risking a duplicate-React-instance
    // bundle (the twin canvas is client-only/WebGL, so this only needs to
    // apply to the client bundle; aliasing "react"/"react-dom" on the
    // server bundle breaks Next's own server/RSC react resolution).
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        react: path.resolve(__dirname, "node_modules/react"),
        "react-dom": path.resolve(__dirname, "node_modules/react-dom"),
        three: path.resolve(__dirname, "node_modules/three"),
        "@react-three/fiber": path.resolve(__dirname, "node_modules/@react-three/fiber"),
        "@react-three/drei": path.resolve(__dirname, "node_modules/@react-three/drei"),
      };
    }
    return config;
  },
};

export default nextConfig;
