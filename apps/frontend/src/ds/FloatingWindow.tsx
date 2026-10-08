import { CrossMedium, Dash, Expand, Icon, Narrow } from '@linagora/twake-icons'
import { Box, IconButton, Paper, Typography } from '@linagora/twake-mui'
import {
  useEffect,
  useState,
  type ComponentProps,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
  type ReactNode
} from 'react'

import {
  fitBox,
  initialBox,
  parseBox,
  resizeBox,
  type Box as Geometry
} from '@/ds/floatingWindowGeometry'

const HEADER_HEIGHT = 48

type Mode = 'normal' | 'minimized' | 'maximized'

interface Labels {
  minimize: string
  maximize: string
  restore: string
  close: string
}

const viewport = () => ({
  width: window.innerWidth,
  height: window.innerHeight
})

// Storage may be off (private mode, blocked site data): the window then opens
// where it starts.
function readGeometry(key: string): Geometry | null {
  try {
    return parseBox(localStorage.getItem(key))
  } catch {
    return null
  }
}

function saveGeometry(key: string, box: Geometry): void {
  try {
    localStorage.setItem(key, JSON.stringify(box))
  } catch {
    // Kept for this page only
  }
}

// A frame filling a floating window. `moving` leaves the pointer to the
// window while it is dragged or resized over the frame.
export function WindowFrame({
  moving,
  ...props
}: Omit<ComponentProps<'iframe'>, 'ref' | 'className' | 'style'> & {
  moving: boolean
}): ReactElement {
  return (
    <Box
      component="iframe"
      {...props}
      className="u-w-100 u-h-100 u-bdw-0"
      sx={{ pointerEvents: moving ? 'none' : 'auto' }}
    />
  )
}

// A window over the page, without a backdrop: the page stays usable. It is
// dragged by its header and resized from its bottom right corner, and its
// place is kept per browser. Its content stays mounted in every mode, so a
// frame in it never reloads.
export function FloatingWindow({
  title,
  storageKey,
  labels,
  onClose,
  children
}: {
  title: string
  storageKey: string
  labels: Labels
  onClose: () => void
  children: (moving: boolean) => ReactNode
}): ReactElement {
  const [box, setBox] = useState(() =>
    fitBox(readGeometry(storageKey) ?? initialBox(viewport()), viewport())
  )
  const [mode, setMode] = useState<Mode>('normal')
  const [moving, setMoving] = useState(false)

  useEffect(() => {
    const fit = () => {
      setBox(current => fitBox(current, viewport()))
    }
    window.addEventListener('resize', fit)
    return () => {
      window.removeEventListener('resize', fit)
    }
  }, [])

  const track =
    (next: (dx: number, dy: number) => Geometry) =>
    (event: ReactPointerEvent<HTMLElement>) => {
      if (event.button !== 0 || mode === 'maximized') return
      if (event.target instanceof Element && event.target.closest('button')) {
        return
      }
      event.preventDefault()
      const handle = event.currentTarget
      const start = { x: event.clientX, y: event.clientY }
      let last = box
      const move = (moved: PointerEvent) => {
        last = next(moved.clientX - start.x, moved.clientY - start.y)
        setBox(last)
      }
      const end = () => {
        handle.removeEventListener('pointermove', move)
        handle.removeEventListener('pointerup', end)
        handle.removeEventListener('pointercancel', end)
        setMoving(false)
        saveGeometry(storageKey, last)
      }
      handle.setPointerCapture(event.pointerId)
      handle.addEventListener('pointermove', move)
      handle.addEventListener('pointerup', end)
      handle.addEventListener('pointercancel', end)
      setMoving(true)
    }

  // Minimized, only the header has to stay on screen; the window is moved
  // back inside when it opens again.
  const drag = track((dx, dy) => {
    const { width, height } = viewport()
    const hidden = mode === 'minimized' ? box.height - HEADER_HEIGHT : 0
    return fitBox(
      { ...box, x: box.x + dx, y: box.y + dy },
      { width, height: height + hidden }
    )
  })
  const resize = track((dx, dy) =>
    resizeBox(box, { width: dx, height: dy }, viewport())
  )
  const toggle = (which: Mode) => () => {
    setMode(current => (current === which ? 'normal' : which))
    setBox(current => fitBox(current, viewport()))
  }

  const place =
    mode === 'maximized'
      ? { inset: 16 }
      : {
          left: box.x,
          top: box.y,
          width: box.width,
          height: mode === 'minimized' ? HEADER_HEIGHT : box.height
        }

  return (
    <Paper
      component="section"
      aria-label={title}
      elevation={8}
      sx={{
        position: 'fixed',
        ...place,
        zIndex: theme => theme.zIndex.modal - 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        borderRadius: 2
      }}
    >
      <Box
        onPointerDown={drag}
        sx={{
          display: 'flex',
          alignItems: 'center',
          flex: '0 0 auto',
          height: HEADER_HEIGHT,
          pl: 2,
          pr: 0.5,
          cursor: mode === 'maximized' ? 'default' : 'move',
          touchAction: 'none',
          userSelect: 'none'
        }}
      >
        <Typography variant="subtitle1" noWrap sx={{ flex: '1 1 auto' }}>
          {title}
        </Typography>
        <IconButton
          aria-label={mode === 'minimized' ? labels.restore : labels.minimize}
          onClick={toggle('minimized')}
        >
          <Icon icon={Dash} />
        </IconButton>
        <IconButton
          aria-label={mode === 'maximized' ? labels.restore : labels.maximize}
          onClick={toggle('maximized')}
        >
          <Icon icon={mode === 'maximized' ? Narrow : Expand} />
        </IconButton>
        <IconButton aria-label={labels.close} onClick={onClose}>
          <Icon icon={CrossMedium} />
        </IconButton>
      </Box>
      <Box
        sx={{
          display: 'flex',
          flex: '1 1 auto',
          minHeight: 0,
          visibility: mode === 'minimized' ? 'hidden' : 'visible'
        }}
      >
        {children(moving)}
      </Box>
      {mode === 'normal' && (
        <Box
          aria-hidden
          onPointerDown={resize}
          sx={{
            position: 'absolute',
            right: 0,
            bottom: 0,
            width: 16,
            height: 16,
            cursor: 'nwse-resize',
            touchAction: 'none'
          }}
        />
      )}
    </Paper>
  )
}
