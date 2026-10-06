import {
  Box,
  Divider,
  Empty,
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

// Empty sizes its icon for 128px illustrations; an app tile is 64px.
export function TileEmpty(props: EmptyProps): ReactElement {
  return <Empty {...props} sx={{ '& .Empty-icon': { height: 64, mb: 3 } }} />
}
