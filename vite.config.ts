import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { devApi } from './server/devApi'

// VITE_BASE=/respawn/ for GitHub Pages; '/' for dev and Vercel.
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [react(), tailwindcss(), devApi()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'server/**/*.test.ts', 'tools/**/*.test.ts'],
  },
} as import('vite').UserConfig)
