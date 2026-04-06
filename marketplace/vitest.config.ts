import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.test.{ts,tsx}'],
    setupFiles: ['./tests/setup.ts'],
    // 5s per test is plenty — worker tests finish in <100ms; anything slower
    // indicates a real problem (infinite loop, hung fetch, unclosed resource).
    testTimeout: 5000,
  },
  resolve: {
    alias: {
      '@marketplace': resolve(__dirname, 'src'),
    },
  },
})
