import { Cube, Icon, Logout, Plus } from '@linagora/twake-icons'
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
import { Outlet, NavLink as RouterNavLink, useMatch } from 'react-router'

import {
  AccountCard,
  AppFrame,
  MobileBar,
  NavAvatar,
  SidebarFooter,
  SidebarHeader,
  SidebarSection
} from '@/ds/AppFrame'
import { useFeedbackButton } from '@/ui/feedback/useFeedbackButton'
import { useI18n } from '@/ui/i18n/useI18n'
import { useSession } from '@/ui/session/SessionGate'
import { CreateSpaceDialog } from '@/ui/home/CreateSpaceDialog'
import { useCommonSettings } from '@/ui/settings/useCommonSettings'
import { useSpaceList } from '@/ui/spaces/queries'

export function AppShell(): ReactElement {
  const { t } = useI18n()
  const [creating, setCreating] = useState(false)
  const home = useMatch('/') !== null
  useFeedbackButton()

  return (
    <AppFrame
      bare={home}
      sidebar={
        <>
          <SidebarHeader
            title={t('shell.title')}
            action={
              <IconButton
                aria-label={t('spaces.create')}
                onClick={() => {
                  setCreating(true)
                }}
              >
                <Icon icon={Plus} />
              </IconButton>
            }
          />
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
      {creating && (
        <CreateSpaceDialog
          onClose={() => {
            setCreating(false)
          }}
        />
      )}
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
  const { settings } = useCommonSettings()
  const email = user.email ?? ''
  const name = settings.displayName ?? user.name ?? email
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const close = (): void => {
    setAnchor(null)
  }
  const avatar = (
    <Avatar
      size="m"
      color={nameToColor(name) ?? 'sunrise'}
      src={settings.avatar ?? undefined}
      aria-hidden
    >
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
          <NavIcon icon={Cube} />
          <NavText>{t('shell.allSpaces')}</NavText>
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
