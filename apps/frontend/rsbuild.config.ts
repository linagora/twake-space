import { readFileSync } from 'node:fs'

import { defineConfig } from '@rsbuild/core'
import { pluginReact } from '@rsbuild/plugin-react'

const { version } = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8')
) as { version: string }

export default defineConfig({
  plugins: [pluginReact()],
  html: {
    template: './index.html'
  },
  source: {
    define: { __APP_VERSION__: JSON.stringify(version) },
    // MOCK=1 runs the app on in-memory services: see docs/frontend-dev.md.
    entry: {
      index: process.env.MOCK === '1' ? './src/mock.tsx' : './src/index.tsx'
    }
  },
  resolve: {
    alias: { '@': './src' }
  },
  server: {
    port: Number(process.env.PORT ?? 3000),
    historyApiFallback: true,
    // With API_URL = '/api' in public/.env.js, the backend answers on this origin.
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        pathRewrite: { '^/api': '' }
      }
    }
  },
  output: {
    sourceMap: { js: false }
  }
})
