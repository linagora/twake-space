import {
  Box,
  Divider,
  Empty,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListSkeleton,
  Typography,
  type EmptyProps
} from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'

export function Page({ children }: { children: ReactNode }): ReactElement {
  return (
    <Box
      component="main"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        flex: '1 1 auto',
        minHeight: 0,
        px: { xs: 2, lg: 3 },
        py: 2
      }}
    >
      {children}
    </Box>
  )
}

export function PageHeader({
  title,
  actions
}: {
  title: ReactNode
  actions?: ReactNode
}): ReactElement {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 2,
        minHeight: 48,
        mb: 2
      }}
    >
      <Typography
        variant="h3"
        component="h1"
        noWrap
        sx={{ fontSize: { xs: 22, lg: 24 } }}
      >
        {title}
      </Typography>
      {actions}
    </Box>
  )
}

export function SpaceHeader({
  avatar,
  title,
  tabs,
  meta
}: {
  avatar: ReactNode
  title: ReactNode
  tabs: ReactNode
  meta?: ReactNode
}): ReactElement {
  return (
    <Box sx={{ mx: { xs: -2, lg: -3 }, mt: -2, mb: 2 }}>
      <Box
        sx={{
          display: 'flex',
          flexWrap: { xs: 'wrap', md: 'nowrap' },
          alignItems: 'center',
          columnGap: 3,
          px: { xs: 2, lg: 3 },
          pt: 1
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            minWidth: 0,
            minHeight: 48
          }}
        >
          {avatar}
          <Typography variant="h5" component="h1" noWrap>
            {title}
          </Typography>
          {meta}
        </Box>
        <Box sx={{ minWidth: 0, flex: '1 1 auto', order: { xs: 1, md: 0 } }}>
          {tabs}
        </Box>
      </Box>
      <Divider />
    </Box>
  )
}

export function LoadingRows({
  label,
  count
}: {
  label: string
  count: number
}): ReactElement {
  return (
    <Box role="status" aria-label={label}>
      <ListSkeleton count={count} hasSecondary />
    </Box>
  )
}

export function RowList({
  label,
  children
}: {
  label: string
  children: ReactNode
}): ReactElement {
  return (
    <List
      aria-label={label}
      sx={{
        py: 0,
        border: 1,
        borderColor: 'divider',
        borderRadius: 2,
        overflow: 'hidden',
        '& > li + li': { borderTop: 1, borderColor: 'divider' }
      }}
    >
      {children}
    </List>
  )
}

// `link` is the row's name as a link; it stretches over the whole row.
export function Row({
  icon,
  link,
  secondary
}: {
  icon: ReactNode
  link: ReactNode
  secondary?: ReactNode
}): ReactElement {
  return (
    <ListItem
      sx={{
        position: 'relative',
        minHeight: 56,
        px: 2,
        '&:hover': { bgcolor: 'action.hover' },
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
      <ListItemIcon>{icon}</ListItemIcon>
      <ListItemText
        primary={link}
        secondary={secondary}
        slotProps={{
          primary: { variant: 'body1', noWrap: true },
          secondary: { variant: 'caption' }
        }}
      />
    </ListItem>
  )
}

// Empty sizes its icon for 128px illustrations; an app tile is 64px.
export function TileEmpty(props: EmptyProps): ReactElement {
  return <Empty {...props} sx={{ '& .Empty-icon': { height: 64, mb: 3 } }} />
}
