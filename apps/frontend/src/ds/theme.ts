import type { ThemeOptions } from '@mui/material/styles'
import type { CSSProperties } from 'react'

// What the Twake theme lacks for Space and the mockups draw. Each belongs in
// twake-mui in time.
declare module '@mui/material/styles' {
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

export const spaceThemeOptions = {
  typography: {
    // The mockup's subtitle3: subtitle2 at 12px, on lines of 18.4px
    subtitle3: {
      fontSize: 12,
      fontWeight: 600,
      lineHeight: '18.4px',
      letterSpacing: '0.25px'
    }
  }
} satisfies ThemeOptions
