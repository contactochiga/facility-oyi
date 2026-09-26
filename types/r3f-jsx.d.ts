// oyi-twin-engine is consumed as local source (see next.config.mjs's
// transpilePackages) and keeps its own node_modules so it still runs
// standalone. That means its files resolve "react"/"@react-three/fiber" to
// a different physical copy than this project's, so @react-three/fiber's
// own module-scoped JSX augmentation (declare module "react/jsx-runtime")
// never reaches engine files under Next's "jsx": "preserve" type-check.
// Declaring it against the global JSX namespace instead is resolution-path
// independent and fixes every consumer regardless of which copy it saw.
import type { ThreeElements } from "@react-three/fiber";

declare global {
  namespace JSX {
    interface IntrinsicElements extends ThreeElements {}
  }
}

export {};
