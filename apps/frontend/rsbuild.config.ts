import { defineConfig } from '@rsbuild/core'
import { pluginReact } from '@rsbuild/plugin-react'

export default defineConfig({
  plugins: [pluginReact()],
  html: {
    template: './index.html'
  },
  source: {
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
