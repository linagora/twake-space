/// <reference types="@rsbuild/core/types" />

declare module '*.css'

// The frontend's package.json version, defined at build by rsbuild.config.ts
declare const __APP_VERSION__: string

// The id of this build, also in /version.json (rsbuild.config.ts)
declare const __BUILD_ID__: string
