import {
  AvatarGroup,
  Box,
  Card,
  CardActionArea,
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
