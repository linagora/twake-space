import {
  AvatarGroup,
  Box,
  Card,
  CardActionArea,
  Skeleton,
  Typography
} from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'

const RADIUS = '20px'

// The mockup's subtitle3, which the theme lacks: subtitle2 at 12px, on two
// lines of 18.4px.
const SMALL_TEXT = {
  fontSize: 12,
  lineHeight: '18.4px'
}

export function CardGrid({ children }: { children: ReactNode }): ReactElement {
  return (
    <Box
      component="ul"
      sx={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: 2,
        m: 0,
        p: 0,
        listStyle: 'none'
      }}
    >
      {children}
    </Box>
  )
}

// `link` is the space's name as a link; it stretches over the whole card.
// `menu` sits above that stretch so it keeps its own click.
export function SpaceCard({
  avatar,
  link,
  description,
  members,
  menu
}: {
  avatar: ReactNode
  link: ReactNode
  description?: string
  members?: ReactNode
  menu?: ReactNode
}): ReactElement {
  return (
    <Card
      component="li"
      sx={{
        height: 192,
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
        p: 1.5,
        borderRadius: RADIUS,
        '&:hover': { boxShadow: 3 },
        '& a': { color: 'text.primary', textDecoration: 'none' },
        '& a::after': { content: '""', position: 'absolute', inset: 0 },
        '&:focus-within': {
          outline: 2,
          outlineColor: 'primary.main',
          outlineOffset: -2
        },
        '& a:focus-visible': { outline: 'none' }
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        {avatar}
        <Typography
          variant="h5"
          component="p"
          noWrap
          sx={{ flex: '1 1 auto', minWidth: 0 }}
        >
          {link}
        </Typography>
        {/* The menu button keeps its 48px target but takes the row's 24px,
            its icon near the corner as in the mockup */}
        {menu && (
          <Box sx={{ position: 'relative', zIndex: 1, m: -1.5 }}>{menu}</Box>
        )}
      </Box>
      {description && (
        <Typography
          variant="subtitle2"
          component="p"
          color="textSecondary"
          sx={{
            ...SMALL_TEXT,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden'
          }}
        >
          {description}
        </Typography>
      )}
      {members}
    </Card>
  )
}

// The first members of a space side by side, the rest counted.
export function MemberAvatars({
  children,
  max = 5
}: {
  children: ReactNode
  max?: number
}): ReactElement {
  return (
    <AvatarGroup
      max={max}
      spacing={0}
      sx={{
        justifyContent: 'flex-end',
        // The white ring is drawn inside the 24px, as in the mockup
        '& .MuiAvatar-root': {
          width: 24,
          height: 24,
          boxSizing: 'border-box',
          fontSize: 11
        }
      }}
    >
      {children}
    </AvatarGroup>
  )
}

// The space home's cards, side by side down to a phone's width.
export function TileGrid({
  min,
  children
}: {
  min: number
  children: ReactNode
}): ReactElement {
  return (
    <Box
      component="ul"
      sx={{
        display: 'grid',
        gridTemplateColumns: `repeat(auto-fill, minmax(min(${String(min)}px, 100%), 1fr))`,
        gap: 3,
        m: 0,
        p: 0,
        listStyle: 'none'
      }}
    >
      {children}
    </Box>
  )
}

// The mockup's grey outlined button, for the buttons of tiles and app cards
const GREY_BUTTONS = {
  '& .MuiButton-outlined': {
    px: 3,
    py: 1.25,
    color: 'text.primary',
    borderColor: 'divider'
  }
}

// The space home's tiles, the figures narrow beside a wide one.
export function TileRow({ children }: { children: ReactNode }): ReactElement {
  return (
    <Box
      component="ul"
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 3,
        m: 0,
        p: 0,
        listStyle: 'none'
      }}
    >
      {children}
    </Box>
  )
}

export function Tile({
  wide = false,
  children
}: {
  wide?: boolean
  children: ReactNode
}): ReactElement {
  return (
    <Card
      component="li"
      sx={{
        flex: wide ? '3 1 360px' : '1 1 140px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: wide ? 'flex-start' : 'center',
        flexWrap: 'wrap',
        gap: 2,
        minHeight: 83,
        py: 1.5,
        pl: wide ? 3.5 : 1.5,
        pr: 1.5,
        borderRadius: RADIUS,
        ...GREY_BUTTONS
      }}
    >
      {children}
    </Card>
  )
}

// A null value is still loading.
export function TileNumber({
  value,
  label
}: {
  value: ReactNode
  label: ReactNode
}): ReactElement {
  return (
    <Box
      aria-busy={value === null ? true : undefined}
      sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
    >
      <Typography component="span" sx={{ fontSize: 32, fontWeight: 700 }}>
        {value ?? <Skeleton width={56} />}
      </Typography>
      <Typography component="span" variant="caption" color="textSecondary">
        {label}
      </Typography>
    </Box>
  )
}

export function CalendarLeaf({
  weekday,
  day,
  month
}: {
  weekday: string
  day: string
  month: string
}): ReactElement {
  const small = { fontSize: 11, fontWeight: 400 }
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 1.5
      }}
    >
      <Typography component="span" color="textSecondary" sx={small}>
        {weekday}
      </Typography>
      <Typography
        component="span"
        sx={{ fontSize: 32, fontWeight: 600, lineHeight: '42px' }}
      >
        {day}
      </Typography>
      <Typography component="span" color="textSecondary" sx={small}>
        {month}
      </Typography>
    </Box>
  )
}

// The mockup tilts the pictures of the apps a little.
export function AppArt({ src }: { src: string }): ReactElement {
  return (
    <Box
      component="img"
      src={src}
      alt=""
      sx={{ maxWidth: 1, transform: 'rotate(-5deg)' }}
    />
  )
}

// `count` is only what is shown ("3", "99+"): `nameLabel` names it for
// assistive technology.
export function AppCard({
  visual,
  icon,
  name,
  nameLabel,
  count,
  description,
  action
}: {
  visual: ReactNode
  icon: ReactNode
  name: string
  nameLabel?: string | undefined
  count: string | null
  description: string
  action: ReactNode
}): ReactElement {
  return (
    <Card
      component="li"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        minHeight: 156,
        p: 1.5,
        borderRadius: RADIUS,
        ...GREY_BUTTONS
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          flex: 'none',
          alignSelf: 'stretch',
          width: 100,
          minHeight: 132,
          p: 1.5,
          borderRadius: RADIUS,
          bgcolor: 'action.hover',
          overflow: 'hidden'
        }}
      >
        {visual}
      </Box>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: 0.75,
          minWidth: 0,
          py: 1.5,
          pr: 1.5
        }}
      >
        <Typography
          variant="h6"
          component="h3"
          aria-label={nameLabel}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.75,
            fontWeight: 600
          }}
        >
          {icon}
          {name}
          {count !== null && (
            <Box
              component="span"
              aria-hidden
              sx={{
                minWidth: 16,
                px: '4.5px',
                borderRadius: '10000px',
                bgcolor: 'action.selected',
                fontSize: 11,
                fontWeight: 500,
                lineHeight: '16px',
                letterSpacing: 0.5,
                textAlign: 'center'
              }}
            >
              {count}
            </Box>
          )}
        </Typography>
        <Typography
          variant="body2"
          component="p"
          color="textSecondary"
          sx={{ fontSize: 12, lineHeight: 1.4 }}
        >
          {description}
        </Typography>
        <Box sx={{ mt: 0.75 }}>{action}</Box>
      </Box>
    </Card>
  )
}

export function CreateCard({
  icon,
  title,
  text,
  onClick
}: {
  icon: ReactNode
  title: string
  text: string
  onClick: () => void
}): ReactElement {
  return (
    <Card component="li" sx={{ height: 192, borderRadius: RADIUS }}>
      <CardActionArea
        onClick={onClick}
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: 1.5,
          p: 1.5,
          textAlign: 'center'
        }}
      >
        <Box
          component="span"
          sx={{ display: 'flex', p: 1.5, color: 'primary.main' }}
        >
          {icon}
        </Box>
        <Typography variant="h5" component="span" noWrap sx={{ maxWidth: 1 }}>
          {title}
        </Typography>
        <Typography variant="subtitle2" color="textSecondary" sx={SMALL_TEXT}>
          {text}
        </Typography>
      </CardActionArea>
    </Card>
  )
}
