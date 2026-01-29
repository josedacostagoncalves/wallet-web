import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  safelist: [
    "bg-green-50",
    "hover:bg-green-100/80",
    "bg-red-50",
    "hover:bg-red-100/80",
    "bg-blue-50",
    "hover:bg-blue-100/80",
    "bg-white",
    "hover:bg-slate-50/50",
  ],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/contexts/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
      fontFamily: {
        sans: ["var(--font-app)"],
        mono: ["var(--font-app)"],
      },
    },
  },
  plugins: [],
};
export default config;
