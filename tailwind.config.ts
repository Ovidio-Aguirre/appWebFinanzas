import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/modules/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-jakarta)", "var(--font-inter)", "sans-serif"],
        mono: ["var(--font-inter)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      colors: {
        surface: {
          DEFAULT: "#0f131d",
          dim: "#0f131d",
          bright: "#353944",
          "container-lowest": "#0a0e18",
          "container-low": "#171b26",
          container: "#1c1f2a",
          "container-high": "#262a35",
          "container-highest": "#313540",
          variant: "#313540",
          tint: "#4edea3",
        },
        "on-surface": {
          DEFAULT: "#dfe2f1",
          variant: "#bbcabf",
        },
        outline: {
          DEFAULT: "#86948a",
          variant: "#3c4a42",
        },
        obsidian: {
          950: "#070a10",
          900: "#0b0f17",
          850: "#101521",
          800: "#151c2c",
          700: "#1f283d",
          600: "#2b3652",
        },
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "#4edea3",
          foreground: "#003824",
          container: "#10b981",
          "on-container": "#00422b",
          fixed: "#6ffbbe",
          "fixed-dim": "#4edea3",
        },
        "on-primary": "#003824",
        secondary: {
          DEFAULT: "#4cd7f6",
          foreground: "#003640",
          container: "#03b5d3",
        },
        "on-secondary": "#003640",
        tertiary: {
          DEFAULT: "#ffb2b7",
          container: "#ff7886",
          "on-container": "#780021",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [],
};

export default config;
