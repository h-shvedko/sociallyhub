import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: ["class"],
  theme: {
    extend: {
      colors: {
        // Legacy shadcn/ui colors (maintained for compatibility)
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
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
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
        chart: {
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))",
        },
        
        // Material Design 3.0 Color System
        "md-primary": "hsl(var(--md-sys-color-primary))",
        "md-on-primary": "hsl(var(--md-sys-color-on-primary))",
        "md-primary-container": "hsl(var(--md-sys-color-primary-container))",
        "md-on-primary-container": "hsl(var(--md-sys-color-on-primary-container))",
        
        "md-secondary": "hsl(var(--md-sys-color-secondary))",
        "md-on-secondary": "hsl(var(--md-sys-color-on-secondary))",
        "md-secondary-container": "hsl(var(--md-sys-color-secondary-container))",
        "md-on-secondary-container": "hsl(var(--md-sys-color-on-secondary-container))",
        
        "md-tertiary": "hsl(var(--md-sys-color-tertiary))",
        "md-on-tertiary": "hsl(var(--md-sys-color-on-tertiary))",
        "md-tertiary-container": "hsl(var(--md-sys-color-tertiary-container))",
        "md-on-tertiary-container": "hsl(var(--md-sys-color-on-tertiary-container))",
        
        "md-error": "hsl(var(--md-sys-color-error))",
        "md-on-error": "hsl(var(--md-sys-color-on-error))",
        "md-error-container": "hsl(var(--md-sys-color-error-container))",
        "md-on-error-container": "hsl(var(--md-sys-color-on-error-container))",
        
        "md-surface": "hsl(var(--md-sys-color-surface))",
        "md-on-surface": "hsl(var(--md-sys-color-on-surface))",
        "md-surface-variant": "hsl(var(--md-sys-color-surface-variant))",
        "md-on-surface-variant": "hsl(var(--md-sys-color-on-surface-variant))",
        
        "md-surface-container-lowest": "hsl(var(--md-sys-color-surface-container-lowest))",
        "md-surface-container-low": "hsl(var(--md-sys-color-surface-container-low))",
        "md-surface-container": "hsl(var(--md-sys-color-surface-container))",
        "md-surface-container-high": "hsl(var(--md-sys-color-surface-container-high))",
        "md-surface-container-highest": "hsl(var(--md-sys-color-surface-container-highest))",
        
        "md-background": "hsl(var(--md-sys-color-background))",
        "md-on-background": "hsl(var(--md-sys-color-on-background))",
        
        "md-outline": "hsl(var(--md-sys-color-outline))",
        "md-outline-variant": "hsl(var(--md-sys-color-outline-variant))",
        
        "md-inverse-surface": "hsl(var(--md-sys-color-inverse-surface))",
        "md-inverse-on-surface": "hsl(var(--md-sys-color-inverse-on-surface))",
        "md-inverse-primary": "hsl(var(--md-sys-color-inverse-primary))",
      },
      borderRadius: {
        // Legacy values
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)", 
        sm: "calc(var(--radius) - 4px)",
        
        // Material Design Shape tokens
        "md-none": "var(--md-sys-shape-corner-none)",
        "md-extra-small": "var(--md-sys-shape-corner-extra-small)",
        "md-small": "var(--md-sys-shape-corner-small)",
        "md-medium": "var(--md-sys-shape-corner-medium)",
        "md-large": "var(--md-sys-shape-corner-large)",
        "md-extra-large": "var(--md-sys-shape-corner-extra-large)",
        "md-full": "var(--md-sys-shape-corner-full)",
      },
      boxShadow: {
        // Material Design Elevation
        "md-level0": "var(--md-sys-elevation-level0)",
        "md-level1": "var(--md-sys-elevation-level1)",
        "md-level2": "var(--md-sys-elevation-level2)",
        "md-level3": "var(--md-sys-elevation-level3)",
        "md-level4": "var(--md-sys-elevation-level4)",
        "md-level5": "var(--md-sys-elevation-level5)",
      },
      animation: {
        // Material Design Motion
        "fade-in": "fadeIn 0.2s ease-out",
        "slide-up": "slideUp 0.3s ease-out",
        "scale-in": "scaleIn 0.2s ease-out",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { transform: "translateY(10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        scaleIn: {
          "0%": { transform: "scale(0.95)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
      },
      fontFamily: {
        // Material Design Typography
        "display": ["var(--font-display)", "system-ui", "sans-serif"],
        "body": ["var(--font-body)", "system-ui", "sans-serif"],
      },
      fontSize: {
        // Material Design Type Scale
        "display-large": ["57px", { lineHeight: "64px", letterSpacing: "-0.25px" }],
        "display-medium": ["45px", { lineHeight: "52px", letterSpacing: "0px" }],
        "display-small": ["36px", { lineHeight: "44px", letterSpacing: "0px" }],
        "headline-large": ["32px", { lineHeight: "40px", letterSpacing: "0px" }],
        "headline-medium": ["28px", { lineHeight: "36px", letterSpacing: "0px" }],
        "headline-small": ["24px", { lineHeight: "32px", letterSpacing: "0px" }],
        "title-large": ["22px", { lineHeight: "28px", letterSpacing: "0px" }],
        "title-medium": ["16px", { lineHeight: "24px", letterSpacing: "0.15px" }],
        "title-small": ["14px", { lineHeight: "20px", letterSpacing: "0.1px" }],
        "body-large": ["16px", { lineHeight: "24px", letterSpacing: "0.5px" }],
        "body-medium": ["14px", { lineHeight: "20px", letterSpacing: "0.25px" }],
        "body-small": ["12px", { lineHeight: "16px", letterSpacing: "0.4px" }],
        "label-large": ["14px", { lineHeight: "20px", letterSpacing: "0.1px" }],
        "label-medium": ["12px", { lineHeight: "16px", letterSpacing: "0.5px" }],
        "label-small": ["11px", { lineHeight: "16px", letterSpacing: "0.5px" }],
      },
    },
  },
  plugins: [],
};

export default config;