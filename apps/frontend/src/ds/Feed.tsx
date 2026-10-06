import { Icon, Plus, Send, type IconProps } from '@linagora/twake-icons'
import {
  Avatar,
  Box,
  Button,
  IconButton,
  InputBase,
  Menu,
  MenuItem,
  TextField,
  Typography
} from '@linagora/twake-mui'
import { useState, type ReactElement, type ReactNode } from 'react'

// The feed reads like a chat: the newest item sits at the bottom, right above
// the composer, and the list scrolls up into older ones.
export function FeedLayout({
  toolbar,
  children,
  composer
}: {
  toolbar: ReactNode
  children: ReactNode
  composer: ReactNode
}): ReactElement {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        flex: '1 1 auto',
        minHeight: 0
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', py: 1 }}>
        {toolbar}
      </Box>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column-reverse',
          flex: '1 1 auto',
          minHeight: 0,
          overflowY: 'auto'
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, pb: 2 }}>
          {children}
        </Box>
      </Box>
      {composer}
    </Box>
  )
}

export function FeedRow({
  avatar,
  label,
  children
}: {
  avatar: ReactNode
  label: string
  children: ReactNode
}): ReactElement {
  return (
    <Box
      component="article"
      aria-label={label}
      sx={{ display: 'flex', alignItems: 'flex-end', gap: 1, maxWidth: 660 }}
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
  ...link
}: {
  icon: IconProps['icon']
  children: ReactNode
} & (
  { onClick: () => void } | { component: React.ElementType; to: string }
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
      {...link}
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
