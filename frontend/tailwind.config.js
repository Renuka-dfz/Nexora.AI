/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Geist', 'sans-serif'],
        mono: ['Geist Mono', 'monospace'],
      },
      colors: {
        // Soft Graphite Design Tokens per Nexora.AI Grayscale Specification
        graphite: {
          bg: '#FAFAF9',        // Background
          surface: '#FFFFFF',   // Surface
          primary: '#252525',   // Primary text / primary button
          secondary: '#737373', // Secondary text
          border: '#E7E5E4',    // Border
          activeNav: '#F0EFED', // Active navigation
          hoverNav: '#F5F5F4',  // Subtle hover
          btnHover: '#383838',  // Button hover
        },
        surface: {
          nav: '#FFFFFF',
          main: '#FAFAF9',
          sidebar: '#FAFAF9',
          card: '#FFFFFF',
          activeNav: '#F0EFED',
        },
        ink: {
          primary: '#252525',
          secondary: '#737373',
        },
        border: {
          subtle: '#E7E5E4',
        },
      },
    },
  },
  plugins: [],
}
