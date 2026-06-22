import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        ois: {
          canvas: "var(--ois-canvas)",
          surface: "var(--ois-surface)",
          primary: "var(--ois-primary)",
          muted: "var(--ois-text-muted)",
        },
      },
      borderRadius: {
        oisControl: "var(--ois-radius-control)",
        oisCard: "var(--ois-radius-card)",
        oisHero: "var(--ois-radius-hero)",
        oisNav: "var(--ois-radius-nav)",
      },
      spacing: {
        ois1: "var(--ois-space-1)",
        ois2: "var(--ois-space-2)",
        ois3: "var(--ois-space-3)",
        ois4: "var(--ois-space-4)",
        ois5: "var(--ois-space-5)",
      },
    },
  },
  plugins: []
} satisfies Config;
