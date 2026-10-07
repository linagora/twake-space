import { Cube, Icon, Plus } from '@linagora/twake-icons'
import { IconButton, Nav, NavIcon, NavItem, NavText } from '@linagora/twake-mui'
import { useState, type ReactElement, type ReactNode } from 'react'
import { Outlet, NavLink as RouterNavLink, useMatch } from 'react-router'

import {
  AppFrame,
  NavAvatar,
  SidebarHeader,
  SidebarSection
} from '@/ds/AppFrame'
import { NavDestination } from '@/ds/NavDestination'
import { useFeedbackButton } from '@/ui/feedback/useFeedbackButton'
import { useI18n } from '@/ui/i18n/useI18n'
import { CreateSpaceDialog } from '@/ui/home/CreateSpaceDialog'
import { PlatformBar } from '@/ui/shell/PlatformBar'
import { useSpaceList } from '@/ui/spaces/queries'

export function AppShell(): ReactElement {
  const { t } = useI18n()
  const [creating, setCreating] = useState(false)
  const home = useMatch('/') !== null
  useFeedbackButton()

  return (
    <AppFrame
      topBar={<PlatformBar />}
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
        </>
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

function RouteNavLink({
  to,
  end = false,
  children
}: {
  to: string
  end?: boolean
  children: ReactNode
}): ReactElement {
  const selected = useMatch({ path: to, end }) !== null

  return (
    <NavDestination
      link={RouterNavLink}
      linkProps={{ to, end }}
      selected={selected}
    >
      {children}
    </NavDestination>
  )
}

function AppNav(): ReactElement {
  const { t } = useI18n()

  return (
    <Nav>
      <NavItem>
        <RouteNavLink to="/" end>
          <NavIcon icon={Cube} />
          <NavText>{t('shell.allSpaces')}</NavText>
        </RouteNavLink>
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
          <RouteNavLink to={`/spaces/${space.id}`}>
            <NavAvatar name={space.name} color={space.color} />
            <NavText>{space.name}</NavText>
          </RouteNavLink>
        </NavItem>
      ))}
    </SidebarSection>
  )
}
