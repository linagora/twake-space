import { Home, Icon, Logout, Team } from '@linagora/twake-icons'
import {
  Avatar,
  Divider,
  getInitials,
  IconButton,
  Link,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  nameToColor,
  Nav,
  NavIcon,
  NavItem,
  NavLink,
  NavText
} from '@linagora/twake-mui'
import { useState, type ReactElement } from 'react'
import {
  Outlet,
  Link as RouterLink,
  NavLink as RouterNavLink
} from 'react-router'

import {
  AccountCard,
  AppFrame,
  BrandMark,
  SidebarSection,
  TopBar,
  TopBarSpacer
} from '@/ds/AppFrame'
import { useI18n } from '@/ui/i18n/useI18n'
import { useSession } from '@/ui/session/SessionGate'
import { useSpaceList } from '@/ui/spaces/queries'

export function AppShell(): ReactElement {
  return (
    <AppFrame
      topBar={<Header />}
      sidebar={
        <>
          <AppNav />
          <SpaceList />
        </>
      }
    >
      <Outlet />
    </AppFrame>
  )
}

function Header(): ReactElement {
  const { t } = useI18n()

  return (
    <TopBar>
      <Link
        component={RouterLink}
        to="/"
        underline="none"
        aria-label={t('app.name')}
      >
        <BrandMark name={t('app.name')} />
      </Link>
      <TopBarSpacer />
      <AccountMenu />
    </TopBar>
  )
}

function AccountMenu(): ReactElement {
  const { t } = useI18n()
  const { user, signOut } = useSession()
  const email = user.email ?? ''
  const name = user.name ?? email
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const close = (): void => {
    setAnchor(null)
  }
  const avatar = (size: 's' | 'l'): ReactElement => (
    <Avatar size={size} color={nameToColor(name) ?? 'sunrise'} aria-hidden>
      {getInitials(name, email)}
    </Avatar>
  )

  return (
    <>
      <IconButton
        aria-label={name}
        aria-haspopup="menu"
        aria-expanded={anchor !== null}
        onClick={event => {
          setAnchor(event.currentTarget)
        }}
      >
        {avatar('s')}
      </IconButton>
      <Menu
        anchorEl={anchor}
        open={anchor !== null}
        onClose={close}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <AccountCard
          avatar={avatar('l')}
          name={name}
          email={email === name ? undefined : email}
        />
        <Divider />
        <MenuItem
          onClick={() => {
            close()
            void signOut()
          }}
        >
          <ListItemIcon>
            <Icon icon={Logout} />
          </ListItemIcon>
          <ListItemText>{t('session.signOut')}</ListItemText>
        </MenuItem>
      </Menu>
    </>
  )
}

function AppNav(): ReactElement {
  const { t } = useI18n()

  return (
    <Nav>
      <NavItem>
        <NavLink component={RouterNavLink} to="/" end>
          <NavIcon icon={Home} />
          <NavText>{t('spaces.title')}</NavText>
        </NavLink>
      </NavItem>
    </Nav>
  )
}

function SpaceList(): ReactElement | null {
  const { t } = useI18n()
  const spaces = useSpaceList().data ?? []
  if (spaces.length === 0) return null

  return (
    <SidebarSection label={t('shell.yourSpaces')}>
      {spaces.map(space => (
        <NavItem key={space.id}>
          <NavLink component={RouterNavLink} to={`/spaces/${space.id}`}>
            <NavIcon icon={Team} />
            <NavText>{space.name}</NavText>
          </NavLink>
        </NavItem>
      ))}
    </SidebarSection>
  )
}
