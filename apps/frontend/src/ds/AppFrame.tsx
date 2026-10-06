import { Icon, Team } from '@linagora/twake-icons'
import {
  Box,
  Content,
  Layout,
  List,
  ListSubheader,
  Sidebar,
  Typography,
  type Theme
} from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'

export function AppFrame({
  topBar,
  sidebar,
  children
}: {
  topBar: ReactNode
  sidebar: ReactNode
  children: ReactNode
}): ReactElement {
  return (
    <Box sx={{ height: '100dvh', display: 'flex', flexDirection: 'column' }}>
      {topBar}
      <Layout
        withTopBar={false}
        sx={(theme: Theme) => ({
          flex: '1 1 auto',
          minHeight: 0,
          [theme.breakpoints.down('lg')]: {
            height: 'auto',
            paddingBottom: 'var(--sidebarHeight)'
          }
        })}
      >
        <Sidebar>{sidebar}</Sidebar>
        {/* Content's own 100% height ignores its margins and scrolls the page */}
        <Content role={undefined} sx={{ height: 'auto' }}>
          {children}
        </Content>
      </Layout>
    </Box>
  )
}

export function TopBar({ children }: { children: ReactNode }): ReactElement {
  return (
    <Box
      component="header"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: { xs: 1, md: 2 },
        flex: '0 0 auto',
        height: 64,
        px: { xs: 2, md: 3 },
        bgcolor: 'background.default'
      }}
    >
      {children}
    </Box>
  )
}

// The brand column lines up with the sidebar below it on wide screens.
export function BrandMark({ name }: { name: string }): ReactElement {
  return (
    <Box
      component="span"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        width: { lg: 204 },
        color: 'primary.main'
      }}
    >
      <Icon icon={Team} size={32} aria-hidden />
      <Typography
        variant="h5"
        component="span"
        color="textPrimary"
        noWrap
        sx={{ display: { xs: 'none', md: 'block' } }}
      >
        {name}
      </Typography>
    </Box>
  )
}

export function TopBarSpacer(): ReactElement {
  return <Box sx={{ flex: '1 1 0' }} />
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
        px: 2,
        py: 1.5,
        minWidth: 240,
        maxWidth: 320
      }}
    >
      {avatar}
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="subtitle1" noWrap>
          {name}
        </Typography>
        {email && (
          <Typography variant="body2" color="textSecondary" noWrap>
            {email}
          </Typography>
        )}
      </Box>
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
        <ListSubheader component="div" sx={{ bgcolor: 'transparent', px: 3 }}>
          {label}
        </ListSubheader>
      }
      sx={{ display: { xs: 'none', lg: 'block' }, py: 0 }}
    >
      {children}
    </List>
  )
}
