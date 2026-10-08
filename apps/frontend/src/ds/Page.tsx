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
// frame of an embedded app, under the tabs. `compact` keeps a narrow edge,
// on a page given to the content.
export function Page({
  fill = true,
  compact = false,
  children
}: {
  fill?: boolean
  compact?: boolean
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
        px: compact ? 1 : { xs: 2, lg: 3 },
        pt: compact ? 1 : 2,
        pb: fill ? (compact ? 1 : 2) : 0
      }}
    >
      {children}
    </Box>
  )
}

export function PageSearch({
  children
}: {
  children: ReactNode
}): ReactElement {
  return <Box sx={{ maxWidth: 834, mb: 2 }}>{children}</Box>
}

// `label` names the panel when its tab is not shown, on a page given to it
export function TabPanel({
  tab,
  label,
  children
}: {
  tab: string
  label?: string | undefined
  children: ReactNode
}): ReactElement {
  return (
    <Box
      role="tabpanel"
      id={`panel-${tab}`}
      aria-label={label}
      aria-labelledby={label === undefined ? `tab-${tab}` : undefined}
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

// The space's header while its content has the page: one line, the way back
// first, so that it is the first stop of the keyboard on its way out of a
// frame.
export function CompactSpaceHeader({
  back,
  avatar,
  title,
  tab
}: {
  back: ReactNode
  avatar: ReactNode
  title: ReactNode
  tab: ReactNode
}): ReactElement {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        minWidth: 0,
        minHeight: 40,
        mb: 1
      }}
    >
      {back}
      {avatar}
      <Typography variant="h6" component="h1" noWrap>
        {title}
      </Typography>
      <Typography variant="body2" color="textSecondary" noWrap>
        {tab}
      </Typography>
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
