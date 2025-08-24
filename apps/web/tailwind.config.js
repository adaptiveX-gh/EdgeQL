/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {}
  },
  plugins: [require('daisyui')],
  daisyui: {
    themes: [
      'light',
      'dark',
      {
        edgeql: {
          'primary': '#3b82f6',
          'primary-focus': '#2563eb',
          'primary-content': '#ffffff',
          'secondary': '#f59e0b',
          'secondary-focus': '#d97706',
          'secondary-content': '#ffffff',
          'accent': '#10b981',
          'accent-focus': '#059669',
          'accent-content': '#ffffff',
          'neutral': '#374151',
          'neutral-focus': '#1f2937',
          'neutral-content': '#ffffff',
          'base-100': '#ffffff',
          'base-200': '#f9fafb',
          'base-300': '#f3f4f6',
          'base-content': '#111827',
          'info': '#3abff8',
          'success': '#36d399',
          'warning': '#fbbd23',
          'error': '#f87272'
        }
      }
    ]
  }
};