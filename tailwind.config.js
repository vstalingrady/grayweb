/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        elevated: "var(--elevated)",
        foreground: "var(--foreground)",
        muted: "var(--muted)",
        border: "var(--border)",
        "border-strong": "var(--border-strong)",
        accent: "var(--accent)",
        danger: "var(--danger)",
        "bg-base": "var(--bg-base)",
        "bg-alt": "var(--bg-alt)",
        "fg-primary": "var(--fg-primary)",
        "fg-muted": "var(--fg-muted)",
        "fg-subtle": "var(--fg-subtle)",
        "fg-hot": "var(--fg-hot)",
        panel: "var(--panel)",
        "panel-strong": "var(--panel-strong)",
        gray: {
          border: "var(--gray-border)",
          "border-strong": "var(--gray-border-strong)",
          panel: "var(--gray-panel)",
          "panel-soft": "var(--gray-panel-soft)",
          "text-muted": "var(--gray-text-muted)",
        },
      },
      borderRadius: {
        lg: "var(--radius-lg)",
        md: "var(--radius-md)",
        sm: "var(--radius-sm)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      boxShadow: {
        deep: "var(--shadow-deep)",
        soft: "var(--shadow-soft)",
      },
      spacing: {
        gutter: "var(--gray-general-inline-gutter)",
      },
      maxWidth: {
        general: "var(--gray-general-max-width)",
        dashboard: "var(--gray-dashboard-max-width)",
      },
    },
  },
  plugins: [],
};
