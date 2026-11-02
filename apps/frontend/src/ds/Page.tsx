import {
  Box,
  Divider,
  Empty,
  Fab,
  ListSkeleton,
  Stack,
  Tooltip,
  Typography,
  type EmptyProps
} from '@linagora/twake-mui'
import { Icon, type IconProps } from '@linagora/twake-icons'
import type { ReactElement, ReactNode } from 'react'

import coverArt from '@/assets/space-cover.png'
import { MenuButton } from '@/ds/AppFrame'

// `fill` off leaves the rest of the content to what follows the page: the
// frame of an embedded app, under the tabs. `compact` keeps a narrow edge,
// on a page given to the content. The page scrolls itself, or content
// overflowing a page shrunk to the screen would cover its bottom edge.
// `head` shares the first row with the menu button of narrow screens; a
// compact page has neither.
export function Page({
  fill = true,
  compact = false,
  head,
  children
}: {
  fill?: boolean
  compact?: boolean
  head?: ReactNode
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
        overflow: 'hidden auto',
        px: compact ? 1 : { xs: 2, lg: 3 },
        pt: compact ? 1 : 2,
        pb: fill ? (compact ? 1 : 2) : 0
      }}
    >
      {!compact && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            minWidth: 0,
            mb: { xs: 1, lg: 0 }
          }}
        >
          <MenuButton />
          {head}
        </Box>
      )}
      {children}
    </Box>
  )
}

// The page's main action, floating in the bottom right corner of narrow
// screens. Its room at the end of the page keeps the last content clear.
export function PhoneFab({
  label,
  onClick,
  children
}: {
  label: string
  onClick: () => void
  children: ReactNode
}): ReactElement {
  return (
    <Box
      sx={{ display: { xs: 'block', lg: 'none' }, flex: 'none', height: 72 }}
    >
      <Tooltip title={label}>
        <Fab
          color="primary"
          aria-label={label}
          onClick={onClick}
          sx={{
            position: 'fixed',
            right: 16,
            bottom: 16,
            zIndex: 'speedDial'
          }}
        >
          {children}
        </Fab>
      </Tooltip>
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

// A panel that scrolls as a whole, under the space's header. Its edge, out
// into the page's, leaves room for the shadows of the cards: 20px holds the
// blur of a hovered card (shadow 3), within the page's 24px on wide screens.
export function ScrollPanel({
  children
}: {
  children: ReactNode
}): ReactElement {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        flex: '1 1 auto',
        minHeight: 0,
        overflowY: 'auto',
        px: { xs: 2, lg: 2.5 },
        mx: { xs: -2, lg: -2.5 },
        pb: 2
      }}
    >
      {children}
    </Box>
  )
}

// `src` replaces the default artwork. The shade under `date` and `title` keeps
// white text readable on any banner an admin uploads.
export function SpaceCover({
  src,
  action,
  date,
  title
}: {
  src?: string | undefined
  action?: ReactNode
  date: ReactNode
  title: ReactNode
}): ReactElement {
  return (
    <Box
      sx={{
        position: 'relative',
        overflow: 'hidden',
        flex: 'none',
        height: { xs: 132, md: 168 },
        borderRadius: '8px',
        bgcolor: 'primary.dark',
        containerType: 'size'
      }}
    >
      {src ? (
        <Box
          component="img"
          src={src}
          alt=""
          sx={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover'
          }}
        />
      ) : (
        // The artwork is portrait; turned, it spans the banner's width.
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
      )}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          px: { xs: 2, md: 3 },
          pb: { xs: 1.5, md: 2.5 },
          color: 'common.white',
          background:
            'linear-gradient(to top, rgba(0,0,0,0.6), rgba(0,0,0,0.15) 60%, transparent)'
        }}
      >
        <Typography variant="body2" sx={{ color: 'inherit', opacity: 0.85 }}>
          {date}
        </Typography>
        <Typography
          variant="h3"
          component="h2"
          sx={{ color: 'inherit', fontSize: { xs: 24, md: 32 } }}
        >
          {title}
        </Typography>
      </Box>
      {action && (
        <Box
          sx={{
            position: 'absolute',
            bottom: 12,
            right: 12,
            '& .MuiIconButton-root': {
              color: 'grey.900',
              bgcolor: 'rgba(255,255,255,0.85)',
              boxShadow: 1,
              '&:hover': { bgcolor: 'common.white' }
            }
          }}
        >
          {action}
        </Box>
      )}
    </Box>
  )
}

// `select` stands for the tabs on a phone: a row of its own, with no line
// under it.
export function SpaceHeader({
  avatar,
  title,
  tabs,
  actions,
  select = false
}: {
  avatar: ReactNode
  title: ReactNode
  tabs: ReactNode
  actions?: ReactNode
  select?: boolean
}): ReactElement {
  return (
    <Box>
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
        <Box
          sx={
            select
              ? // Out of the title's inset, as wide as the page
                { order: 1, flex: '1 0 calc(100% + 12px)', ml: -1.5, mb: 1 }
              : {
                  minWidth: 0,
                  flex: '1 1 auto',
                  order: { xs: 1, md: 0 },
                  alignSelf: 'flex-end'
                }
          }
        >
          {tabs}
        </Box>
        {actions && (
          <Box sx={{ display: 'flex', gap: 1, ml: 'auto' }}>{actions}</Box>
        )}
      </Box>
      {/* 16px from the card's edges, as in the mockup, out of the page's 24px */}
      {!select && <Divider sx={{ mx: { lg: -1 } }} />}
    </Box>
  )
}

// The space's header while its content has the page: one line, the way back
// at its end, where the full page button was. Still the header's only stop,
// so the first of the keyboard on its way out of a frame.
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
      {avatar}
      <Typography variant="h6" component="h1" noWrap>
        {title}
      </Typography>
      <Typography variant="body2" color="textSecondary" noWrap>
        {tab}
      </Typography>
      <Box sx={{ ml: 'auto', flexShrink: 0 }}>{back}</Box>
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

export function IconEmpty({
  icon,
  title
}: {
  icon: IconProps['icon']
  title: string
}): ReactElement {
  return (
    <Empty
      icon={
        <Box aria-hidden>
          <Icon icon={icon} size={124} />
        </Box>
      }
      title={title}
      componentsProps={{ title: { component: 'h2' } }}
      sx={{
        '& .Empty-icon': {
          width: 200,
          height: 200,
          mb: 5,
          display: 'grid',
          placeItems: 'center',
          borderRadius: '33%',
          bgcolor: 'action.selected',
          color: 'background.paper'
        },
        '& .Empty-icon svg': {
          filter: 'drop-shadow(0 2px 10px rgb(0 0 0 / 10%))'
        }
      }}
    />
  )
}
