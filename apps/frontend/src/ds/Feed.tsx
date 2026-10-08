import { Down, Icon, Plus, Send, type IconProps } from '@linagora/twake-icons'
import {
  Avatar,
  Box,
  Button,
  Checkbox,
  IconButton,
  InputBase,
  ListItemText,
  Menu,
  MenuItem,
  TextField,
  Typography
} from '@linagora/twake-mui'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode
} from 'react'

import { ChevronDownIcon } from '@/ds/icons'

// How close to the newest item still counts as being there, and how close to
// the oldest one asks for older items.
const AT_END = 32
const NEAR_TOP = 200
// The height of the fade at the top of the list.
const FADE = 32

const RevealContext = createContext<(row: HTMLElement) => void>(() => undefined)

// The feed reads like a chat: the oldest item on top, the newest right above
// the composer. `placeKey` is null while the list loads; on each new one, the
// list opens on the `FeedNewMark`, or else on the newest item. It follows the
// newest items while the person is there, and otherwise keeps the rows in view
// still while rows come in above or below.
export function FeedLayout({
  toolbar,
  children,
  composer,
  placeKey,
  latestLabel,
  onAtEndChange,
  onNearTop
}: {
  toolbar: ReactNode
  children: ReactNode
  composer: ReactNode
  placeKey: string | null
  latestLabel: string
  onAtEndChange?: (atEnd: boolean) => void
  onNearTop?: () => void
}): ReactElement {
  const scroller = useRef<HTMLDivElement>(null)
  const content = useRef<HTMLDivElement>(null)
  const atEnd = useRef(true)
  const [behind, setBehind] = useState(false)
  // The first row in view, and where it sits on the screen: when the list
  // grows above or shrinks, the rows hold still under the eye.
  const anchor = useRef<{ row: Element; top: number } | null>(null)
  // A scroll this layout made itself is not the person scrolling.
  const ownScroll = useRef(false)

  const reportAtEnd = useEffectEvent((value: boolean) => {
    onAtEndChange?.(value)
  })
  // Read from the ref: on the render that places the list, `behind` is still
  // the one from before the placement.
  useEffect(() => {
    if (placeKey !== null) reportAtEnd(atEnd.current)
  }, [placeKey, behind])

  const scrollTo = (top: number) => {
    const list = scroller.current
    if (!list) return
    const before = list.scrollTop
    list.scrollTop = top
    if (list.scrollTop !== before) ownScroll.current = true
  }
  const measure = (keepAnchor = false) => {
    const list = scroller.current
    if (!list) return
    atEnd.current =
      list.scrollHeight - list.scrollTop - list.clientHeight <= AT_END
    setBehind(!atEnd.current)
    if (keepAnchor) return
    const top = list.getBoundingClientRect().top
    const row = Array.from(list.querySelectorAll('article')).find(
      item => item.getBoundingClientRect().bottom > top
    )
    anchor.current = row ? { row, top: row.getBoundingClientRect().top } : null
  }
  const keepPlace = useEffectEvent((rowsChanged: boolean) => {
    const list = scroller.current
    if (!list) return
    const kept = anchor.current
    if (atEnd.current) {
      scrollTo(list.scrollHeight)
    } else if (
      kept?.row.isConnected &&
      // At the very top, the list resizing pushes the first rows down like a
      // page, instead of hiding them.
      (rowsChanged || list.scrollTop > 0)
    ) {
      scrollTo(list.scrollTop + kept.row.getBoundingClientRect().top - kept.top)
    }
    measure()
  })
  // At once, not smoothly: the list resizing on the way would stop a smooth
  // scroll short of the end.
  const toEnd = () => {
    atEnd.current = true
    scrollTo(scroller.current?.scrollHeight ?? 0)
    measure()
  }
  const reveal = useCallback((row: HTMLElement) => {
    const list = scroller.current
    if (!list) return
    const top = list.getBoundingClientRect().top
    const box = row.getBoundingClientRect()
    scrollTo(
      list.scrollTop + box.top - top - (list.clientHeight - box.height) / 2
    )
    measure()
  }, [])

  useLayoutEffect(() => {
    const list = scroller.current
    const rows = content.current
    if (!list || !rows || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(entries => {
      keepPlace(entries.some(entry => entry.target === rows))
    })
    observer.observe(list)
    observer.observe(rows)
    return () => {
      observer.disconnect()
    }
  }, [])

  useLayoutEffect(() => {
    const list = scroller.current
    if (placeKey === null || !list) return
    const mark = list.querySelector('[data-feed-new]')
    scrollTo(
      mark
        ? list.scrollTop +
            mark.getBoundingClientRect().top -
            list.getBoundingClientRect().top
        : list.scrollHeight
    )
    measure()
  }, [placeKey])

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        flex: '1 1 auto',
        minHeight: 0
      }}
    >
      <Box
        sx={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          flex: '1 1 auto',
          minHeight: 0
        }}
      >
        {/* Over the list, so that no row of its own sits above the first card. */}
        <Box
          sx={{
            position: 'absolute',
            top: 8,
            right: { xs: 0, md: 24 },
            zIndex: 1
          }}
        >
          {toolbar}
        </Box>
        <Box
          ref={scroller}
          sx={{
            flex: '1 1 auto',
            minHeight: 0,
            overflowY: 'auto',
            // The cards fade out under the top edge instead of being cut.
            maskImage: `linear-gradient(to bottom, transparent 0, #000 ${String(FADE)}px)`,
            // The layout keeps its rows in place itself, the same everywhere.
            overflowAnchor: 'none'
          }}
          onScroll={event => {
            const own = ownScroll.current
            ownScroll.current = false
            // The event of a scroll the layout made lands a frame late, when
            // the rows may have moved again: the anchor it set still holds.
            measure(own)
            if (event.currentTarget.scrollTop < NEAR_TOP) onNearTop?.()
          }}
        >
          <Box
            ref={content}
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
              pt: 5,
              pb: 2
            }}
          >
            <RevealContext value={reveal}>{children}</RevealContext>
          </Box>
        </Box>
        {behind && (
          <Button
            size="small"
            startIcon={<Icon icon={Down} size={16} />}
            onClick={toEnd}
            sx={{
              position: 'absolute',
              bottom: 16,
              left: '50%',
              transform: 'translateX(-50%)',
              borderRadius: 100,
              boxShadow: 2
            }}
          >
            {latestLabel}
          </Button>
        )}
      </Box>
      {/* Sending a message brings the person back to the newest items. */}
      <Box onSubmitCapture={toEnd}>{composer}</Box>
    </Box>
  )
}

/** Above the first item the person has not seen, where the feed opens. */
export function FeedNewMark({ label }: { label: string }): ReactElement {
  return (
    <Box
      data-feed-new
      role="separator"
      aria-label={label}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        color: 'error.main',
        '&::before, &::after': {
          content: '""',
          flex: '1 1 auto',
          borderTop: 1,
          borderColor: 'currentColor'
        }
      }}
    >
      <Typography variant="caption" sx={{ fontWeight: 600 }} aria-hidden>
        {label}
      </Typography>
    </Box>
  )
}

// A `focused` row takes the focus once, and the feed brings it into view. It
// stands out while it keeps the focus.
export function FeedRow({
  avatar,
  label,
  focused = false,
  children
}: {
  avatar: ReactNode
  label: string
  focused?: boolean
  children: ReactNode
}): ReactElement {
  const ref = useRef<HTMLElement>(null)
  const reveal = useContext(RevealContext)
  useEffect(() => {
    const row = ref.current
    if (!focused || !row) return
    row.focus({ preventScroll: true })
    reveal(row)
  }, [focused, reveal])

  return (
    <Box
      ref={ref}
      component="article"
      aria-label={label}
      tabIndex={focused ? -1 : undefined}
      sx={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: 1,
        maxWidth: 660,
        outline: 'none',
        '&:focus > :last-child': { bgcolor: 'action.selected' }
      }}
    >
      <Box sx={{ flex: '0 0 36px', display: 'flex' }}>{avatar}</Box>
      <Box
        sx={{
          position: 'relative',
          flex: '1 1 auto',
          minWidth: 0,
          bgcolor: 'background.default',
          borderRadius: '16px',
          px: 2,
          py: 1.25,
          display: 'flex',
          flexDirection: 'column',
          gap: 0.5
        }}
      >
        {children}
      </Box>
    </Box>
  )
}

/** A 36px round tile with an app's icon, for cards an app sends. */
export function AppAvatar({
  icon,
  label,
  color
}: {
  icon: IconProps['icon']
  label: string
  color: string
}): ReactElement {
  return (
    <Avatar
      size="m"
      aria-label={label}
      title={label}
      sx={{ bgcolor: color, color: 'common.white' }}
    >
      <Icon icon={icon} size={18} />
    </Avatar>
  )
}

export function FeedHeader({
  who,
  what,
  menu
}: {
  who: ReactNode
  what: ReactNode
  menu?: ReactNode
}): ReactElement {
  return (
    <Box
      sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minHeight: 20 }}
    >
      <Typography
        variant="caption"
        sx={{ color: 'secondary.main', fontWeight: 500, letterSpacing: 0.5 }}
      >
        {who}
      </Typography>
      <Typography
        variant="caption"
        color="textSecondary"
        sx={{ fontWeight: 500, flex: '1 1 auto', minWidth: 0 }}
        noWrap
      >
        {what}
      </Typography>
      {menu}
    </Box>
  )
}

export function FeedTitle({ children }: { children: ReactNode }): ReactElement {
  return (
    <Typography
      variant="body2"
      sx={{ fontWeight: 600, letterSpacing: 0.25, overflowWrap: 'anywhere' }}
    >
      {children}
    </Typography>
  )
}

export function FeedDetail({
  children
}: {
  children: ReactNode
}): ReactElement {
  return (
    <Typography
      variant="caption"
      color="textSecondary"
      sx={{ fontWeight: 500 }}
    >
      {children}
    </Typography>
  )
}

export function FeedBody({ children }: { children: ReactNode }): ReactElement {
  return (
    <Typography
      sx={{
        fontSize: 15,
        lineHeight: '20px',
        letterSpacing: -0.15,
        whiteSpace: 'pre-wrap',
        overflowWrap: 'anywhere'
      }}
    >
      {children}
    </Typography>
  )
}

/** Reactions and actions on the left, the time on the right. */
export function FeedFooter({
  children,
  time
}: {
  children: ReactNode
  time: ReactNode
}): ReactElement {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 0.5,
        mt: 0.5
      }}
    >
      {children}
      <Typography
        variant="caption"
        color="textSecondary"
        sx={{ fontWeight: 500, ml: 'auto' }}
      >
        {time}
      </Typography>
    </Box>
  )
}

export function FeedAction({
  icon,
  children,
  ...action
}: {
  icon: IconProps['icon']
  children: ReactNode
} & (
  { component: React.ElementType; to: string } | { onClick: () => void }
)): ReactElement {
  return (
    <Button
      size="small"
      variant="text"
      startIcon={<Icon icon={icon} size={16} />}
      sx={{
        borderRadius: 100,
        px: 1,
        py: 0.5,
        minHeight: 0,
        fontSize: 11,
        fontWeight: 500
      }}
      {...action}
    >
      {children}
    </Button>
  )
}

export function ReactionChip({
  emoji,
  count,
  mine,
  label,
  onClick
}: {
  emoji: string
  count: number
  mine: boolean
  label: string
  onClick: () => void
}): ReactElement {
  return (
    <Box
      component="button"
      type="button"
      aria-pressed={mine}
      aria-label={label}
      onClick={onClick}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        p: '4px 6px 4px 4px',
        border: 1,
        borderColor: mine ? 'primary.main' : 'divider',
        bgcolor: mine ? 'action.selected' : 'transparent',
        borderRadius: '16px',
        cursor: 'pointer',
        font: 'inherit'
      }}
    >
      <Box
        component="span"
        aria-hidden
        sx={{ fontSize: 16, lineHeight: '20px' }}
      >
        {emoji}
      </Box>
      <Typography component="span" variant="body2" color="textSecondary">
        {count}
      </Typography>
    </Box>
  )
}

export function ReactionPicker({
  label,
  emojis,
  onPick
}: {
  label: string
  emojis: string[]
  onPick: (emoji: string) => void
}): ReactElement {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  return (
    <>
      <IconButton
        size="small"
        aria-label={label}
        aria-haspopup="menu"
        onClick={event => {
          setAnchor(event.currentTarget)
        }}
      >
        <Icon icon={Plus} size={16} />
      </IconButton>
      <Menu
        anchorEl={anchor}
        open={anchor !== null}
        onClose={() => {
          setAnchor(null)
        }}
        sx={{ '& .MuiList-root': { display: 'flex' } }}
      >
        {emojis.map(emoji => (
          <MenuItem
            key={emoji}
            aria-label={emoji}
            onClick={() => {
              setAnchor(null)
              onPick(emoji)
            }}
            sx={{ fontSize: 20 }}
          >
            {emoji}
          </MenuItem>
        ))}
      </Menu>
    </>
  )
}

export function FeedCentered({
  children
}: {
  children: ReactNode
}): ReactElement {
  return <Box sx={{ alignSelf: 'center' }}>{children}</Box>
}

export function FeedEditForm({
  label,
  value,
  onChange,
  onSubmit,
  actions
}: {
  label: string
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  actions: ReactNode
}): ReactElement {
  return (
    <Box
      component="form"
      onSubmit={event => {
        event.preventDefault()
        onSubmit()
      }}
    >
      <TextField
        multiline
        fullWidth
        size="small"
        label={label}
        value={value}
        onChange={event => {
          onChange(event.target.value)
        }}
        slotProps={{ htmlInput: { maxLength: 4000 } }}
      />
      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', mt: 1 }}>
        {actions}
      </Box>
    </Box>
  )
}

export function EventSummary({
  tile,
  children
}: {
  tile: ReactNode
  children: ReactNode
}): ReactElement {
  return (
    <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
      {tile}
      <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {children}
      </Box>
    </Box>
  )
}

/** A calendar day: the month on an orange band above the date. */
export function DateTile({
  month,
  day
}: {
  month: string
  day: string
}): ReactElement {
  return (
    <Box
      aria-hidden
      sx={{
        flex: '0 0 32px',
        width: 32,
        borderRadius: '6px',
        overflow: 'hidden',
        textAlign: 'center',
        bgcolor: 'background.paper',
        boxShadow: 1
      }}
    >
      <Box
        sx={{
          bgcolor: '#f67e35',
          color: 'common.white',
          fontSize: 7,
          lineHeight: '10px',
          textTransform: 'uppercase'
        }}
      >
        {month}
      </Box>
      <Box sx={{ fontSize: 15, lineHeight: '22px' }}>{day}</Box>
    </Box>
  )
}

export function FeedComposer({
  label,
  sendLabel,
  value,
  onChange,
  onSend,
  disabled
}: {
  label: string
  sendLabel: string
  value: string
  onChange: (value: string) => void
  onSend: () => void
  disabled: boolean
}): ReactElement {
  const empty = value.trim() === ''
  return (
    <Box
      component="form"
      onSubmit={event => {
        event.preventDefault()
        if (!empty && !disabled) onSend()
      }}
      sx={{ display: 'flex', alignItems: 'flex-end', gap: 1, pt: 1 }}
    >
      <InputBase
        multiline
        maxRows={6}
        placeholder={label}
        inputProps={{ 'aria-label': label, maxLength: 4000 }}
        value={value}
        onChange={event => {
          onChange(event.target.value)
        }}
        onKeyDown={event => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault()
            event.currentTarget.closest('form')?.requestSubmit()
          }
        }}
        sx={{
          flex: '1 1 auto',
          border: 1,
          borderColor: 'divider',
          borderRadius: '24px',
          px: 2,
          py: 1,
          fontSize: 16
        }}
      />
      <IconButton
        type="submit"
        aria-label={sendLabel}
        disabled={empty || disabled}
        sx={{
          width: 44,
          height: 44,
          bgcolor: 'primary.main',
          color: 'common.white',
          '&:hover': { bgcolor: 'primary.dark' },
          '&.Mui-disabled': { bgcolor: 'primary.light', color: 'common.white' }
        }}
      >
        <Icon icon={Send} />
      </IconButton>
    </Box>
  )
}

/** The filter as a chip over the list; one option holds at a time. */
export function FeedFilterMenu<T extends string>({
  label,
  options,
  value,
  onChange
}: {
  label: string
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
}): ReactElement {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  return (
    <>
      <Button
        variant="text"
        size="small"
        endIcon={<Icon icon={ChevronDownIcon} size={16} />}
        aria-haspopup="menu"
        aria-expanded={anchor !== null}
        onClick={event => {
          setAnchor(event.currentTarget)
        }}
        sx={{
          height: 32,
          px: 1.5,
          borderRadius: '8px',
          bgcolor: 'background.default',
          color: 'text.primary',
          fontSize: 12,
          fontWeight: 500,
          letterSpacing: 0.5,
          '&:hover': { bgcolor: 'action.hover' }
        }}
      >
        {label}
      </Button>
      <Menu
        anchorEl={anchor}
        open={anchor !== null}
        onClose={() => {
          setAnchor(null)
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: theme => ({
              width: 256,
              borderRadius: '16px',
              boxShadow: theme.space.menuShadow
            })
          }
        }}
      >
        {options.map(option => (
          <MenuItem
            key={option.value}
            role="menuitemradio"
            aria-checked={option.value === value}
            selected={option.value === value}
            onClick={() => {
              onChange(option.value)
              setAnchor(null)
            }}
            sx={{ minHeight: 40, pl: 2, gap: 2, fontSize: 16 }}
          >
            <Checkbox
              size="small"
              checked={option.value === value}
              tabIndex={-1}
              disableRipple
              slotProps={{ input: { 'aria-hidden': true } }}
              sx={{ p: 0, pointerEvents: 'none' }}
            />
            <ListItemText>{option.label}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </>
  )
}
