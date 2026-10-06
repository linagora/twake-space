import {
  Box,
  Card,
  CardActionArea,
  CardHeader,
  Typography,
  cardHeaderClasses
} from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'

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
export function SpaceCard({
  avatar,
  link
}: {
  avatar: ReactNode
  link: ReactNode
}): ReactElement {
  return (
    <Card
      component="li"
      className="u-bdrs-8"
      sx={{
        height: 192,
        position: 'relative',
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
      <CardHeader
        avatar={avatar}
        title={link}
        slotProps={{ title: { variant: 'h5', noWrap: true } }}
        sx={{
          p: 1.5,
          [`& .${cardHeaderClasses.avatar}`]: { mr: 1.5 },
          [`& .${cardHeaderClasses.content}`]: { minWidth: 0 }
        }}
      />
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
    <Card component="li" className="u-bdrs-8" sx={{ height: 192 }}>
      <CardActionArea
        onClick={onClick}
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: 1.5,
          p: 1.5,
          textAlign: 'center'
        }}
      >
        <Box
          component="span"
          sx={{ display: 'flex', p: 2, color: 'primary.main' }}
        >
          {icon}
        </Box>
        <Typography variant="h5" component="span">
          {title}
        </Typography>
        <Typography variant="caption" color="textSecondary">
          {text}
        </Typography>
      </CardActionArea>
    </Card>
  )
}
