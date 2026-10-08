import type { ThemeOptions } from '@mui/material/styles'
import type { CSSProperties } from 'react'

// What the Twake theme lacks for Space and the mockups draw. Each belongs in
// twake-mui in time.
declare module '@mui/material/styles' {
  interface Theme {
    space: SpaceTokens
  }
  interface ThemeOptions {
    space?: SpaceTokens
  }
  interface TypographyVariants {
    subtitle3: CSSProperties
  }
  interface TypographyVariantsOptions {
    subtitle3?: CSSProperties
  }
}

declare module '@mui/material/Typography' {
  interface TypographyPropsVariantOverrides {
    subtitle3: true
  }
}

interface PageBackground {
  base: string
  layers: string[]
}

export interface SpaceTokens {
  // The page behind the panels, in each color scheme
  page: { light: PageBackground; dark: PageBackground }
}

export const spaceThemeOptions = {
  typography: {
    // The mockup's subtitle3: subtitle2 at 12px, on lines of 18.4px
    subtitle3: {
      fontSize: 12,
      fontWeight: 600,
      lineHeight: '18.4px',
      letterSpacing: '0.25px'
    }
  },
  space: {
    page: {
      // Pink from the top left corner, green to the bottom right, on blue
      light: {
        base: '#dde9fe',
        layers: [
          'radial-gradient(ellipse 66% 110% at 0% 0%, #fbefef 30%, transparent 100%)',
          'radial-gradient(ellipse 100% 55% at 100% 100%, #eaf7f0 8%, transparent 100%)'
        ]
      },
      dark: {
        base: '#1a3146',
        layers: [
          'radial-gradient(at 0% 0%, #363648 0px, transparent 55%)',
          'radial-gradient(at 100% 0%, #193745 0px, transparent 55%)',
          'radial-gradient(at 100% 100%, #2e3648 0px, transparent 55%)'
        ]
      }
    }
  }
} satisfies ThemeOptions
