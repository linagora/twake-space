import { Box } from '@linagora/twake-mui'
import type { ComponentProps, ReactElement, Ref } from 'react'

// The frame of an embedded app: it fills its place, or with `fillsPage` the
// whole page, under TwakeSpace's own dialogs.
export function EmbedFrame({
  frameRef,
  fillsPage,
  ...props
}: Omit<ComponentProps<'iframe'>, 'ref' | 'className' | 'style'> & {
  frameRef: Ref<HTMLIFrameElement>
  fillsPage: boolean
}): ReactElement {
  return (
    <Box
      component="iframe"
      ref={frameRef}
      {...props}
      className="u-w-100 u-flex-auto u-bdw-0"
      sx={
        fillsPage
          ? {
              position: 'fixed',
              inset: 0,
              height: '100%',
              zIndex: theme => theme.zIndex.modal - 1
            }
          : undefined
      }
    />
  )
}
