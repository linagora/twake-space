import { Box } from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'

// Holds what must survive while hidden (an app's frame): hidden, it keeps its
// size and its state, out of the layout and out of reach (`inert`). Not
// `display: none`, which would size the app to nothing.
export function KeptAlive({
  active,
  children
}: {
  active: boolean
  children: ReactNode
}): ReactElement {
  return (
    <Box
      className="u-flex u-flex-column u-flex-auto"
      aria-hidden={active ? undefined : true}
      inert={!active}
      sx={
        active
          ? undefined
          : {
              position: 'absolute',
              inset: 0,
              visibility: 'hidden',
              pointerEvents: 'none'
            }
      }
    >
      {children}
    </Box>
  )
}

// The place of the tab panels: kept frames sit over it, hidden.
export function KeptAliveStack({
  children
}: {
  children: ReactNode
}): ReactElement {
  return (
    <Box
      className="u-flex u-flex-column u-flex-auto"
      sx={{ position: 'relative' }}
    >
      {children}
    </Box>
  )
}
