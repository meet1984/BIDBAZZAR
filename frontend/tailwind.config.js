/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        slate: {
          dark: "#0F172A",
          card: "#FFFFFF",
          hover: "#F8FAFC",
          border: "#E2E8F0",
          subtle: "#F1F5F9",
        },
        blue: {
          DEFAULT: "#2563EB",
          light: "#3B82F6",
          dark: "#1D4ED8",
          glow: "rgba(37, 99, 235, 0.18)",
        },
        surface: {
          DEFAULT: "#FFFFFF",
          secondary: "#F8FAFC",
        },
      },
      fontFamily: {
        serif: ["Playfair Display", "Georgia", "serif"],
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
      },
      boxShadow: {
        "blue-sm": "0 0 12px rgba(37, 99, 235, 0.15)",
        "blue-md": "0 0 24px rgba(37, 99, 235, 0.25)",
        "blue-lg": "0 0 40px rgba(37, 99, 235, 0.35)",
        "card-elevated": "0 15px 35px 0 rgba(15, 23, 42, 0.08)",
      },
    },
  },
  plugins: [],
};
