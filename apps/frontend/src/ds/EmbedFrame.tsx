import { Box } from '@linagora/twake-mui'
import type { ComponentProps, ReactElement, Ref } from 'react'

import type { WindowBody } from '@/ds/FloatingWindow'

// The frame of an embedded app: it fills its place, or with `over` the body
// of a floating window, without leaving its place in the page (a frame moved
// in the document loads again). Above the window, under TwakeSpace's dialogs,
// which open later in the page.
export function EmbedFrame({
  frameRef,
  over = null,
  ...props
}: Omit<ComponentProps<'iframe'>, 'ref' | 'className' | 'style'> & {
  frameRef: Ref<HTMLIFrameElement>
  over?: WindowBody | null
}): ReactElement {
  return (
    <Box
      component="iframe"
      ref={frameRef}
      {...props}
      className={over ? 'u-bdw-0' : 'u-w-100 u-flex-auto u-bdw-0'}
      sx={
        over
          ? {
              position: 'fixed',
              left: over.left,
              top: over.top,
              width: over.width,
              height: over.height,
              zIndex: theme => theme.zIndex.modal,
              visibility: over.hidden ? 'hidden' : 'visible',
              pointerEvents: over.moving ? 'none' : 'auto'
            }
          : undefined
      }
    />
  )
}
