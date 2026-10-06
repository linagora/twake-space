import { Box } from '@linagora/twake-mui'
import {
  useLayoutEffect,
  useRef,
  type ReactElement,
  type RefObject
} from 'react'
import { createPortal } from 'react-dom'

// A frame over the whole page, under TwakeSpace's own dialogs, that only
// shows and takes clicks within `clipPath`: the browser does not hit test
// what a clip path cuts out, so the page under it stays usable.
export function OverlayFrame({
  name,
  src,
  title,
  sandbox,
  allow,
  clipPath,
  frameRef
}: {
  name: string
  src: string
  title: string
  sandbox: string
  allow: string
  clipPath: string
  frameRef?: RefObject<HTMLIFrameElement | null>
}): ReactElement {
  const ownRef = useRef<HTMLIFrameElement>(null)
  const ref = frameRef ?? ownRef
  const empty = clipPath.startsWith('inset(')

  // Set by hand: it changes with every move of a menu, a class per value
  // would pile up.
  useLayoutEffect(() => {
    if (ref.current) ref.current.style.clipPath = clipPath
  }, [clipPath, ref])

  return createPortal(
    <Box
      component="iframe"
      ref={ref}
      name={name}
      src={src}
      title={title}
      sandbox={sandbox}
      allow={allow}
      aria-hidden={empty || undefined}
      tabIndex={empty ? -1 : undefined}
      sx={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        border: 0,
        background: 'transparent',
        // A frame whose colour scheme differs from the page is painted opaque
        colorScheme: 'normal',
        zIndex: theme => theme.zIndex.modal - 1
      }}
    />,
    document.body
  )
}
