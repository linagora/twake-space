import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) }
  },
  define: { __BUILD_ID__: JSON.stringify('test') },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/testing/setupTests.ts'],
    css: false,
    restoreMocks: true,
    server: { deps: { inline: [/@linagora\//] } }
  }
})
