import { Cube, Icon, Plus } from '@linagora/twake-icons'
import { IconButton, Nav, NavIcon, NavItem, NavText } from '@linagora/twake-mui'
import { useState, type ReactElement, type ReactNode } from 'react'
import { Outlet, NavLink as RouterNavLink, useMatch } from 'react-router'

import { badgeLabel, hasCounts, spaceTotal } from '@/application/badges'
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
import { useBadges } from '@/ui/space/Badges'
import { EmbeddedApps } from '@/ui/space/EmbeddedApps'
import { useSpaceList, useSpaces } from '@/ui/spaces/queries'

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
      <EmbeddedApps />
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
  label,
  children
}: {
  to: string
  end?: boolean
  // Names the link, when its text alone does not
  label?: string | undefined
  children: ReactNode
}): ReactElement {
  const selected = useMatch({ path: to, end }) !== null

  return (
    <NavDestination
      link={RouterNavLink}
      linkProps={{ to, end, 'aria-label': label }}
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
  const badges = useBadges()
  // The list holds no resources: an app's counts are by resource, so the
  // spaces are read once an app has reported any. They are the spaces the
  // screen reads, already in the cache once visited.
  const details = useSpaces(
    spaces.map(space => space.id),
    hasCounts(badges)
  )
  if (spaces.length === 0) return null

  return (
    <SidebarSection label={t('shell.yourSpaces')}>
      {spaces.map((space, index) => {
        const detail = details[index]?.data
        const total = detail ? spaceTotal(badges, detail) : 0
        return (
          <NavItem key={space.id} badge={badgeLabel(total)}>
            <RouteNavLink
              to={`/spaces/${space.id}`}
              label={
                total > 0
                  ? t('shell.spaceWithCount', {
                      name: space.name,
                      smart_count: total
                    })
                  : undefined
              }
            >
              <NavAvatar name={space.name} color={space.color} />
              <NavText>{space.name}</NavText>
            </RouteNavLink>
          </NavItem>
        )
      })}
    </SidebarSection>
  )
}
