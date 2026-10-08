import {
  Avatar,
  Box,
  Content,
  Layout,
  List,
  ListSubheader,
  nameToColor,
  Sidebar,
  Typography,
  getInitials,
  styled
} from '@linagora/twake-mui'
import { TWAKE_BAR_HEIGHT } from '@linagora/twake-bar'
import type { ReactElement, ReactNode } from 'react'

// Layout hands `sx` to a plain div, so it is styled here instead. The page
// behind the panels is the mockups' soft gradient, lit from each corner.
const Frame = styled(Layout, {
  shouldForwardProp: prop => prop !== 'belowBar'
})<{ belowBar: boolean }>(({ theme, belowBar }) => ({
  '--topBarHeight': belowBar ? TWAKE_BAR_HEIGHT : '0px',
  height: 'calc(100dvh - var(--topBarHeight))',
  backgroundColor: '#e2eaf9',
  backgroundImage: [
    'radial-gradient(at 0% 0%, #faf5f7 0px, transparent 55%)',
    'radial-gradient(at 100% 0%, #dde9ff 0px, transparent 55%)',
    'radial-gradient(at 100% 100%, #e9f7f0 0px, transparent 55%)'
  ].join(', '),
  ...theme.applyStyles('dark', {
    backgroundColor: '#1a3146',
    backgroundImage: [
      'radial-gradient(at 0% 0%, #363648 0px, transparent 55%)',
      'radial-gradient(at 100% 0%, #193745 0px, transparent 55%)',
      'radial-gradient(at 100% 100%, #2e3648 0px, transparent 55%)'
    ].join(', ')
  }),
  [theme.breakpoints.down('lg')]: {
    height: 'auto',
    minHeight: 'calc(100dvh - var(--topBarHeight))',
    flexDirection: 'column',
    paddingBottom: 'var(--sidebarHeight)'
  }
}))

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

const TopBar = styled('div')({
  position: 'sticky',
  top: 0,
  zIndex: 1100
})

// `bare` swaps the content's white panel for the dashboard's frosted one,
// which continues the sidebar.
export function AppFrame({
  topBar,
  sidebar,
  bare = false,
  children
}: {
  topBar?: ReactNode
  sidebar: ReactNode
  bare?: boolean
  children: ReactNode
}): ReactElement {
  return (
    <>
      {topBar && <TopBar>{topBar}</TopBar>}
      <Frame withTopBar={false} belowBar={Boolean(topBar)}>
        <GlassSidebar>{sidebar}</GlassSidebar>
        {/* Content's own 100% height ignores its margins and scrolls the page */}
        <Content
          role={undefined}
          sx={theme => ({
            height: 'auto',
            position: 'relative',
            [theme.breakpoints.up('lg')]: bare
              ? {
                  m: '12px 12px 12px 0',
                  borderRadius: '0 16px 16px 0',
                  bgcolor: theme.alpha(
                    theme.vars.palette.background.paper,
                    0.45
                  )
                }
              : { m: '12px 12px 12px 0', borderRadius: '0 16px 16px 0' }
          })}
        >
          {children}
        </Content>
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
        pl: 3,
        pr: 2
      }}
    >
      <Typography variant="h3" component="p">
        {title}
      </Typography>
      <Box sx={{ display: 'flex', gap: 0.5 }}>{action}</Box>
    </Box>
  )
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

// Phones get the bottom bar only; the section stays on wide screens.
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
            px: 3,
            typography: 'caption',
            lineHeight: '32px'
          }}
        >
          {label}
        </ListSubheader>
      }
      sx={{ display: { xs: 'none', lg: 'block' }, py: 0 }}
    >
      {children}
    </List>
  )
}

// `label` names the person for assistive technology; without it the avatar
// is decoration next to the name it stands for.
export function NameAvatar({
  name,
  size,
  color,
  label
}: {
  name: string
  size: 'xs' | 's' | 'm' | 'l'
  color?: string | null
  label?: string
}): ReactElement {
  return (
    <Avatar
      size={size}
      color={color ?? nameToColor(name) ?? 'sunrise'}
      aria-hidden={label === undefined}
      aria-label={label}
      title={label}
    >
      {getInitials(name, '')}
    </Avatar>
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
