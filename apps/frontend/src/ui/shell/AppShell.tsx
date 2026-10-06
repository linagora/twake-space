import { Home, Icon, Logout } from '@linagora/twake-icons'
import {
  Avatar,
  ButtonBase,
  getInitials,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  nameToColor,
  Nav,
  NavIcon,
  NavItem,
  NavLink,
  NavText,
  Typography
} from '@linagora/twake-mui'
import { useState, type ReactElement } from 'react'
import { Outlet, NavLink as RouterNavLink } from 'react-router'

import {
  AccountCard,
  AppFrame,
  MobileBar,
  NavAvatar,
  SidebarFooter,
  SidebarHeader,
  SidebarSection
} from '@/ds/AppFrame'
import { useI18n } from '@/ui/i18n/useI18n'
import { useSession } from '@/ui/session/SessionGate'
import { useSpaceList } from '@/ui/spaces/queries'

export function AppShell(): ReactElement {
  const { t } = useI18n()

  return (
    <AppFrame
      sidebar={
        <>
          <SidebarHeader title={t('app.name')} />
          <AppNav />
          <SpaceList />
          <SidebarFooter>
            <AccountMenu variant="card" />
          </SidebarFooter>
        </>
      }
      mobileBar={
        <MobileBar>
          <Typography variant="h5" component="p">
            {t('app.name')}
          </Typography>
          <AccountMenu variant="avatar" />
        </MobileBar>
      }
    >
      <Outlet />
    </AppFrame>
  )
}

function AccountMenu({
  variant
}: {
  variant: 'card' | 'avatar'
}): ReactElement {
  const { t } = useI18n()
  const { user, signOut } = useSession()
  const email = user.email ?? ''
  const name = user.name ?? email
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const close = (): void => {
    setAnchor(null)
  }
  const avatar = (
    <Avatar size="m" color={nameToColor(name) ?? 'sunrise'} aria-hidden>
      {getInitials(name, email)}
    </Avatar>
  )
  const trigger = {
    'aria-label': name,
    'aria-haspopup': 'menu' as const,
    'aria-expanded': anchor !== null,
    onClick: (event: React.MouseEvent<HTMLElement>) => {
      setAnchor(event.currentTarget)
    }
  }

  return (
    <>
      {variant === 'card' ? (
        <ButtonBase
          {...trigger}
          className="u-w-100 u-p-half u-bdrs-4 u-flex-justify-start"
        >
          <AccountCard
            avatar={avatar}
            name={name}
            email={email === name ? undefined : email}
          />
        </ButtonBase>
      ) : (
        <IconButton {...trigger}>{avatar}</IconButton>
      )}
      <Menu
        anchorEl={anchor}
        open={anchor !== null}
        onClose={close}
        anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
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
            <NavAvatar name={space.name} color={space.color} />
            <NavText>{space.name}</NavText>
          </NavLink>
        </NavItem>
      ))}
    </SidebarSection>
  )
}
