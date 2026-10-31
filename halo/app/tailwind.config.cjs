const path = require("path");
const v = (n) => `rgb(var(--${n}) / <alpha-value>)`;
module.exports = {
  content: [path.join(__dirname, "index.html"), path.join(__dirname, "src/**/*.{ts,tsx}"), path.join(__dirname, "../partner/**/*.{ts,tsx}")],
  theme: {
    extend: {
      colors: {
        bg: v("bg"), surface: v("surface"), sunk: v("sunk"), ink: v("ink"), muted: v("muted"), line: v("line"),
        accent: v("accent"), "accent-ink": v("accent-ink"),
        safe: v("safe"), "safe-bg": v("safe-bg"), warn: v("warn"), "warn-bg": v("warn-bg"), danger: v("danger"), "danger-bg": v("danger-bg"),
        bank: v("bank"), "bank-ink": v("bank-ink"),
      },
      fontFamily: {
        display: ["Literata", "Georgia", "serif"],
        body: ["'Atkinson Hyperlegible'", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "Menlo", "monospace"],
      },
    },
  },
  safelist: ["text-safe", "text-warn", "text-danger", "bg-safe", "bg-warn", "bg-danger"],
  plugins: [],
};
