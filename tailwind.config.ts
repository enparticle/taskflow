import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        bg:      "var(--bg)",
        "bg-2":  "var(--bg-2)",
        "bg-3":  "var(--bg-3)",
        "bg-4":  "var(--bg-4)",
        border:  "var(--border)",
        "border-2": "var(--border-2)",
        t1:      "var(--text-1)",
        t2:      "var(--text-2)",
        t3:      "var(--text-3)",
        accent:  "var(--accent)",
      },
      fontFamily: {
        sans: ["Pretendard", "-apple-system", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
