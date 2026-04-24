import typography from "@tailwindcss/typography";

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        duo: {
          bg: "#0b0d10",
          surface: "#16181c",
          sidebar: "#101215",
          rail: "#0b0d10",
          border: "#22262d",
          accent: "#5865f2",
          accenthover: "#4752c4",
          muted: "#8a94a4",
          text: "#e7eaf0",
          danger: "#ed4245",
        },
      },
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
        ],
      },
    },
  },
  plugins: [typography],
};
