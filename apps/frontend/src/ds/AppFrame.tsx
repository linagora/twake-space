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
import type { ReactElement, ReactNode } from 'react'

// Layout hands `sx` to a plain div, so it is styled here instead.
const Frame = styled(Layout)(({ theme }) => ({
  height: '100dvh',
  [theme.breakpoints.down('lg')]: {
    height: 'auto',
    minHeight: '100dvh',
    flexDirection: 'column',
    paddingBottom: 'var(--sidebarHeight)'
  }
}))

export function AppFrame({
  sidebar,
  mobileBar,
  children
}: {
  sidebar: ReactNode
  mobileBar: ReactNode
  children: ReactNode
}): ReactElement {
  return (
    <Frame withTopBar={false}>
      <Sidebar>{sidebar}</Sidebar>
      {mobileBar}
      {/* Content's own 100% height ignores its margins and scrolls the page */}
      <Content role={undefined} sx={{ height: 'auto' }}>
        {children}
      </Content>
    </Frame>
  )
}

// Below lg the sidebar is a bottom bar, so the account moves up here.
export function MobileBar({ children }: { children: ReactNode }): ReactElement {
  return (
    <Box
      component="header"
      sx={{
        display: { xs: 'flex', lg: 'none' },
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 56,
        px: 2,
        bgcolor: 'background.paper',
        borderBottom: 1,
        borderColor: 'divider'
      }}
    >
      {children}
    </Box>
  )
}

export function SidebarHeader({ title }: { title: ReactNode }): ReactElement {
  return (
    <Box
      sx={{
        display: { xs: 'none', lg: 'block' },
        pt: 2,
        px: 3
      }}
    >
      <Typography variant="h3" component="p">
        {title}
      </Typography>
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

export function SidebarFooter({
  children
}: {
  children: ReactNode
}): ReactElement {
  return (
    <Box
      sx={{
        display: { xs: 'none', lg: 'block' },
        mt: 'auto',
        p: 1,
        borderTop: 1,
        borderColor: 'divider'
      }}
    >
      {children}
    </Box>
  )
}

export function NameAvatar({
  name,
  size
}: {
  name: string
  size: 'xs' | 's' | 'm' | 'l'
}): ReactElement {
  return (
    <Avatar size={size} color={nameToColor(name) ?? 'sunrise'} aria-hidden>
      {getInitials(name, '')}
    </Avatar>
  )
}

// NavIcon only takes an icon; avatars need the same slot.
export function NavAvatar({ name }: { name: string }): ReactElement {
  return (
    <Box component="span" sx={{ display: 'flex', mr: 1.5 }}>
      <NameAvatar name={name} size="xs" />
    </Box>
  )
}

export function AccountCard({
  avatar,
  name,
  email
}: {
  avatar: ReactNode
  name: string
  email?: string | undefined
}): ReactElement {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        minWidth: 0
      }}
    >
      {avatar}
      <Box sx={{ minWidth: 0, textAlign: 'start' }}>
        <Typography variant="body2" color="textPrimary" noWrap>
          {name}
        </Typography>
        {email && (
          <Typography variant="caption" component="p" noWrap>
            {email}
          </Typography>
        )}
      </Box>
    </Box>
  )
}
