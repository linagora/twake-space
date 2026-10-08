import {
  Box,
  Collapse,
  Divider,
  Empty,
  ListSkeleton,
  Stack,
  Typography,
  type EmptyProps
} from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'

import coverArt from '@/assets/space-cover.png'

// `fill` off leaves the rest of the content to what follows the page: the
// frame of an embedded app, under the tabs.
export function Page({
  fill = true,
  children
}: {
  fill?: boolean
  children: ReactNode
}): ReactElement {
  return (
    <Box
      component="main"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        flex: fill ? '1 1 auto' : '0 0 auto',
        minHeight: 0,
        px: { xs: 2, lg: 3 },
        pt: 2,
        pb: fill ? 2 : 0
      }}
    >
      {children}
    </Box>
  )
}

export function TabPanel({
  tab,
  children
}: {
  tab: string
  children: ReactNode
}): ReactElement {
  return (
    <Box
      role="tabpanel"
      id={`panel-${tab}`}
      aria-labelledby={`tab-${tab}`}
      sx={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        flex: '1 1 auto',
        minHeight: 0
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
  actions,
  cover
}: {
  avatar: ReactNode
  title: ReactNode
  tabs: ReactNode
  actions?: ReactNode
  cover: boolean
}): ReactElement {
  return (
    <Box sx={{ mb: 2 }}>
      <Collapse
        in={cover}
        unmountOnExit
        sx={{
          '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
          // A short screen needs all its height for the feed itself.
          '@media (max-height: 500px)': { display: 'none' }
        }}
      >
        <Box
          sx={{
            position: 'relative',
            overflow: 'hidden',
            height: { xs: 120, md: 211 },
            borderRadius: '8px',
            bgcolor: 'primary.dark',
            containerType: 'size'
          }}
        >
          {/* The artwork is portrait; turned, it spans the banner's width. */}
          <Box
            component="img"
            src={coverArt}
            alt=""
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              height: '100cqw',
              maxWidth: 'none',
              transform: 'translate(-50%, -50%) rotate(-90deg)'
            }}
          />
        </Box>
      </Collapse>
      <Box
        sx={{
          display: 'flex',
          flexWrap: { xs: 'wrap', md: 'nowrap' },
          alignItems: 'center',
          columnGap: 2,
          pl: 1.5
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            minWidth: 0,
            minHeight: 52
          }}
        >
          {avatar}
          <Typography variant="h5" component="h1" noWrap>
            {title}
          </Typography>
        </Box>
        <Box sx={{ minWidth: 0, flex: '1 1 auto', order: { xs: 1, md: 0 } }}>
          {tabs}
        </Box>
        {actions && (
          <Box sx={{ display: 'flex', gap: 1, ml: 'auto' }}>{actions}</Box>
        )}
      </Box>
      <Divider />
    </Box>
  )
}

export function SetupPrompt({
  title,
  text,
  actions
}: {
  title: string
  text: string
  actions: ReactNode
}): ReactElement {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 3,
        textAlign: 'center',
        py: { xs: 6, md: 15 }
      }}
    >
      <Stack spacing={1.25} sx={{ alignItems: 'center' }}>
        <Typography variant="h3" component="h2">
          {title}
        </Typography>
        <Typography
          variant="body2"
          color="textSecondary"
          sx={{ maxWidth: 393 }}
        >
          {text}
        </Typography>
      </Stack>
      <Stack
        direction="row"
        useFlexGap
        spacing={2}
        sx={{ flexWrap: 'wrap', justifyContent: 'center' }}
      >
        {actions}
      </Stack>
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
