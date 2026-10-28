import { CrossMedium, Icon } from '@linagora/twake-icons'
import {
  Avatar,
  Box,
  Content,
  Divider,
  IconButton,
  Layout,
  List,
  ListSubheader,
  Nav,
  nameToColor,
  Sidebar,
  Tooltip,
  Typography,
  getInitials,
  styled
} from '@linagora/twake-mui'
import { TWAKE_BAR_HEIGHT } from '@linagora/twake-bar'
import { useEffect, useRef, type ReactElement, type ReactNode } from 'react'

const SCREEN_HEIGHT = 'calc(100dvh - var(--topBarHeight))'

// Layout hands `sx` to a plain div, so it is styled here instead. The page
// behind the panels is the mockups' soft gradient, lit from each corner.
const Frame = styled(Layout, {
  shouldForwardProp: prop =>
    prop !== 'belowBar' && prop !== 'alone' && prop !== 'fitScreen'
})<{ belowBar: boolean; alone: boolean; fitScreen: boolean }>(
  ({ theme, belowBar, alone, fitScreen }) => ({
    '--topBarHeight': belowBar ? TWAKE_BAR_HEIGHT : '0px',
    height: SCREEN_HEIGHT,
    backgroundColor: theme.space.page.light.base,
    backgroundImage: theme.space.page.light.layers.join(', '),
    ...theme.applyStyles('dark', {
      backgroundColor: theme.space.page.dark.base,
      backgroundImage: theme.space.page.dark.layers.join(', ')
    }),
    [theme.breakpoints.down('lg')]: {
      height: fitScreen ? SCREEN_HEIGHT : 'auto',
      minHeight: SCREEN_HEIGHT,
      flexDirection: 'column',
      paddingBottom: alone ? 0 : 'var(--sidebarHeight)'
    }
  })
)

// A frosted panel on the gradient; below lg it stays the bottom bar.
const GlassSidebar = styled(Sidebar)(({ theme }) => ({
  [theme.breakpoints.up('lg')]: {
    margin: '12px 0 12px 12px',
    borderRadius: '20px 0 0 20px',
    backgroundColor: theme.alpha(theme.vars.palette.background.paper, 0.6),
    backdropFilter: 'blur(20px)',
    boxShadow:
      '0 0 2px rgba(153, 153, 153, 0.1), 0 2px 4px rgba(153, 153, 153, 0.3)'
  }
}))

// A panel beside the content, on wide screens; below lg it takes the screen.
const Aside = styled('aside')(({ theme }) => ({
  flex: 'none',
  display: 'flex',
  flexDirection: 'column',
  minHeight: 0,
  width: 365,
  margin: '12px 12px 12px 0',
  borderRadius: '16px',
  overflow: 'hidden',
  backgroundColor: theme.vars.palette.background.paper,
  [theme.breakpoints.down('lg')]: {
    position: 'fixed',
    inset: 0,
    width: 'auto',
    margin: 0,
    borderRadius: 0,
    zIndex: theme.zIndex.modal
  }
}))

// The aside's own way out, for content that brings none: below lg the aside
// covers the button that opened it. Focus goes in, so Escape reaches it, and
// back to the opener when the close button goes, unless it moved on since.
export function AsideClosable({
  title,
  closeLabel,
  onClose,
  children
}: {
  title: string
  closeLabel: string
  onClose: () => void
  children: ReactNode
}): ReactElement {
  const close = useRef<HTMLButtonElement>(null)
  const opener = useRef<Element | null>(null)
  useEffect(() => {
    // Strict mode runs this twice: the second time, focus is already ours
    const from = (opener.current ??= document.activeElement)
    close.current?.focus()
    return () => {
      const lost =
        document.activeElement === null ||
        document.activeElement === document.body
      if (lost && from instanceof HTMLElement) from.focus()
    }
  }, [])
  return (
    <Box
      onKeyDown={event => {
        if (event.key === 'Escape') onClose()
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          minHeight: 56,
          pl: 2,
          pr: 1
        }}
      >
        <Typography
          variant="h4"
          component="h2"
          sx={{ flex: '1 1 auto', minWidth: 0 }}
        >
          {title}
        </Typography>
        <IconButton
          ref={close}
          size="medium"
          aria-label={closeLabel}
          onClick={onClose}
          sx={{ color: 'text.secondary' }}
        >
          <Icon icon={CrossMedium} />
        </IconButton>
      </Box>
      {children}
    </Box>
  )
}

const TopBar = styled('div')({
  position: 'sticky',
  top: 0,
  zIndex: 1100
})

// `bare` swaps the content's white panel for the dashboard's frosted one,
// which continues the sidebar. `aside` is a panel beside the content.
// `alone` gives the whole page to the content, its aside kept: no top bar,
// no sidebar, no margin. The content keeps its place in the tree, so the
// frames it holds are not loaded again. Below lg the page scrolls as a whole,
// unless `fitScreen` keeps it at the window height for content that scrolls
// itself, like a feed that opens on its newest items.
export function AppFrame({
  topBar,
  sidebar,
  bare = false,
  aside,
  alone = false,
  fitScreen = false,
  children
}: {
  topBar?: ReactNode
  sidebar: ReactNode
  bare?: boolean
  aside?: ReactNode
  alone?: boolean
  fitScreen?: boolean
  children: ReactNode
}): ReactElement {
  const margin = aside ? '12px 8px 12px 0' : '12px 12px 12px 0'
  const barShown = Boolean(topBar) && !alone
  return (
    <>
      {barShown && <TopBar>{topBar}</TopBar>}
      <Frame
        withTopBar={false}
        belowBar={barShown}
        alone={alone}
        fitScreen={fitScreen}
      >
        {!alone && <GlassSidebar>{sidebar}</GlassSidebar>}
        {/* Content's own 100% height ignores its margins and scrolls the page */}
        <Content
          role={undefined}
          sx={theme => ({
            height: 'auto',
            position: 'relative',
            [theme.breakpoints.up('lg')]: alone
              ? { m: 0, borderRadius: 0 }
              : bare
                ? {
                    m: margin,
                    borderRadius: '0 16px 16px 0',
                    bgcolor: theme.alpha(
                      theme.vars.palette.background.paper,
                      0.45
                    )
                  }
                : { m: margin, borderRadius: '0 16px 16px 0' }
          })}
        >
          {children}
        </Content>
        {aside && <Aside>{aside}</Aside>}
      </Frame>
    </>
  )
}

export function SidebarHeader({
  title,
  action
}: {
  title: ReactNode
  action?: ReactNode
}): ReactElement {
  return (
    <Box
      sx={{
        display: { xs: 'none', lg: 'flex' },
        alignItems: 'center',
        justifyContent: 'space-between',
        pt: 2,
        px: 2
      }}
    >
      <Typography variant="h3" component="p">
        {title}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center' }}>{action}</Box>
    </Box>
  )
}

// 16px from the header and the section around it, on wide screens; below lg
// Nav keeps the bottom bar's own margins.
const SpacedNav = styled(Nav)(({ theme }) => ({
  [theme.breakpoints.up('lg')]: { margin: theme.spacing(2, 0) }
}))

export function SidebarNav({
  children
}: {
  children: ReactNode
}): ReactElement {
  return <SpacedNav>{children}</SpacedNav>
}

export function SidebarDivider(): ReactElement {
  return <Divider sx={{ mx: 2, my: 1 }} />
}

// Under the header, on wide screens like the list it filters.
export function SidebarSearch({
  children
}: {
  children: ReactNode
}): ReactElement {
  return (
    <Box sx={{ display: { xs: 'none', lg: 'flex' }, px: 2, pt: 1 }}>
      {children}
    </Box>
  )
}

const sidebarBadge = {
  // One digit is a 16px circle, longer counts a pill, whatever box model and
  // radius the theme gives badges.
  '& .MuiBadge-badge': {
    boxSizing: 'border-box',
    minWidth: 16,
    height: 16,
    px: '4.5px',
    borderRadius: '8px',
    fontSize: 11,
    fontWeight: 500,
    lineHeight: '16px',
    letterSpacing: '0.5px'
  }
}

// Phones get the bottom bar only; the section stays on wide screens. Sections
// sit 16px apart.
export function SidebarSection({
  label,
  children
}: {
  label: string
  children: ReactNode
}): ReactElement {
  return (
    <List
      aria-label={label}
      subheader={
        <ListSubheader
          component="div"
          sx={{
            bgcolor: 'transparent',
            px: 2,
            py: 0,
            mb: 2,
            typography: 'caption',
            color: 'text.secondary'
          }}
        >
          {label}
        </ListSubheader>
      }
      sx={{
        display: { xs: 'none', lg: 'block' },
        py: 0,
        mb: 2,
        ...sidebarBadge
      }}
    >
      {children}
    </List>
  )
}

// `label` names the person, in a tooltip and for assistive technology;
// without it the avatar is decoration next to the name it stands for. The
// initials show when there is no picture or it fails to load.
export function NameAvatar({
  name,
  size,
  color,
  label,
  src
}: {
  name: string
  size: 'xs' | 's' | 'm' | 'l' | number
  color?: string | null
  label?: string
  src?: string | null
}): ReactElement {
  const avatar = (
    <Avatar
      size={size}
      color={color ?? nameToColor(name) ?? 'sunrise'}
      src={src ?? undefined}
      alt=""
      aria-hidden={label === undefined}
    >
      {getInitials(name, '')}
    </Avatar>
  )
  return label === undefined ? (
    avatar
  ) : (
    <Tooltip title={label}>{avatar}</Tooltip>
  )
}

// NavIcon only takes an icon; avatars need the same slot.
export function NavAvatar({
  name,
  color
}: {
  name: string
  color: string | null
}): ReactElement {
  return (
    <Box component="span" sx={{ display: 'flex', mr: 1.5 }}>
      <NameAvatar name={name} size="xs" color={color} />
    </Box>
  )
}
