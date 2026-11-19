/** @type {import('tailwindcss').Config} */
export default {
  content: ["./app/**/*.{js,jsx}", "./components/**/*.{js,jsx}", "./lib/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        plum: {
          50: "#F7F3FA",
          100: "#F0E9F6",
          200: "#DFD1EB",
          300: "#C3A9DA",
          400: "#9A6DBD",
          500: "#6B3FA0",
          600: "#5A3189",
          700: "#4E2971",
          800: "#3F2159",
          900: "#2F1843",
        },
        gold: {
          50: "#FDF9EC",
          100: "#FAF0CE",
          200: "#F4E1A0",
          300: "#EBCB6E",
          400: "#E5C05C",
          500: "#E1B752",
          600: "#C79E3D",
          700: "#A17E2E",
        },
        ink: "#26242E",
        muted: "#6E6A76",
        line: "#E7E4E0",
        canvas: "#F7F6F3",
        cream: "#FCF7E6",
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        display: [
          "Inter Tight",
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "sans-serif",
        ],
      },
      letterSpacing: {
        tightest: "-0.045em",
      },
      boxShadow: {
        card: "0 1px 2px rgba(38,36,46,.05)",
        float: "0 18px 40px -16px rgba(38,36,46,.22)",
        bar: "0 10px 30px -12px rgba(38,36,46,.20)",
      },
      borderRadius: {
        xl2: "1.25rem",
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "-400px 0" },
          "100%": { backgroundPosition: "400px 0" },
        },
        "slide-up": {
          "0%": { transform: "translateY(16px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
      animation: {
        shimmer: "shimmer 1.4s ease-in-out infinite linear",
        "slide-up": "slide-up .25s ease-out",
        "fade-in": "fade-in .2s ease-out",
      },
    },
  },
  plugins: [],
};
