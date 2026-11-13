import { readFileSync } from 'node:fs'

import { defineConfig, type RsbuildPlugin } from '@rsbuild/core'
import { pluginReact } from '@rsbuild/plugin-react'

const { version } = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8')
) as { version: string }

// One id per build, in the bundle and in /version.json: a tab that reads
// another one there offers a reload. The commit in CI (Dockerfile), the time
// of the build otherwise (an ARG left out is an empty string).
const buildFromEnv = process.env.BUILD_ID ?? ''
const buildId = buildFromEnv !== '' ? buildFromEnv : Date.now().toString(36)

const pluginVersionFile: RsbuildPlugin = {
  name: 'twake-version-file',
  setup: api => {
    api.processAssets({ stage: 'additional' }, ({ compilation, sources }) => {
      compilation.emitAsset(
        'version.json',
        new sources.RawSource(JSON.stringify({ build: buildId }))
      )
    })
  }
}

const svg = (name: string): string =>
  readFileSync(new URL(`./src/assets/${name}.svg`, import.meta.url), 'utf8')

export default defineConfig({
  plugins: [pluginReact(), pluginVersionFile],
  html: {
    template: './index.html',
    // The splash draws them before any script runs, SignInScreen after.
    templateParameters: {
      spaceIcon: svg('space'),
      workplaceLogo: svg('twake-workplace')
    },
    // The logo of the platform bar and the app tiles, emitted and linked as
    // an SVG icon. Without it, Rsbuild would pick public/favicon.ico alone.
    favicon: './src/assets/space.svg'
  },
  source: {
    define: {
      __APP_VERSION__: JSON.stringify(version),
      __BUILD_ID__: JSON.stringify(buildId)
    },
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
