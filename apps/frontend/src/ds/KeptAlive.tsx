import { Box } from '@linagora/twake-mui'
import type { HTMLAttributes, ReactElement, ReactNode } from 'react'

// Holds what must survive while hidden (an app's frame): hidden, it keeps its
// size and its state, out of the layout and out of reach (`inert`). Not
// `display: none`, which would size the app to nothing. `reachable` keeps it
// within reach while hidden, for a frame that floats over the page.
export function KeptAlive({
  active,
  reachable = false,
  children
}: {
  active: boolean
  reachable?: boolean
  children: ReactNode
}): ReactElement {
  const hidden = !active && !reachable
  return (
    <Box
      className="u-flex u-flex-column u-flex-auto"
      aria-hidden={hidden ? true : undefined}
      inert={hidden}
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

// The place of the frames, under the shell's content: in the flow, with the
// page's padding (none when `flush`, on a page given to the content), while
// a framed tab shows; hidden over the content otherwise, so the frames keep
// a real size.
export function KeptAliveStack({
  active,
  reachable = false,
  flush = false,
  children,
  ...rest
}: {
  active: boolean
  reachable?: boolean
  flush?: boolean
  children: ReactNode
} & Pick<
  HTMLAttributes<HTMLDivElement>,
  'role' | 'id' | 'aria-label' | 'aria-labelledby'
>): ReactElement {
  const hidden = !active && !reachable
  return (
    <Box
      {...rest}
      className="u-flex u-flex-column u-flex-auto"
      aria-hidden={hidden ? true : undefined}
      inert={hidden}
      sx={
        active
          ? {
              position: 'relative',
              minHeight: 0,
              px: flush ? 0 : { xs: 2, lg: 3 },
              pb: flush ? 0 : 2
            }
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
