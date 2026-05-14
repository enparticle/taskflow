import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontSize: {
        'xs':  ['13px', { lineHeight: '1.6' }],
        'sm':  ['15px', { lineHeight: '1.65' }],
        'base':['16px', { lineHeight: '1.7' }],
        'lg':  ['18px', { lineHeight: '1.7' }],
        'xl':  ['20px', { lineHeight: '1.6' }],
        '2xl': ['24px', { lineHeight: '1.4' }],
      },
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
