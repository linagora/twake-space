import { Cube, Icon, Key, Plus } from '@linagora/twake-icons'
import {
  IconButton,
  ListItem,
  ListItemText,
  Nav,
  NavIcon,
  NavItem,
  NavText,
  SearchBar
} from '@linagora/twake-mui'
import { useState, type ReactElement, type ReactNode } from 'react'
import { Outlet, NavLink as RouterNavLink, useMatch } from 'react-router'

import { badgeLabel, hasCounts, spaceTotal } from '@/application/badges'
import { nameMatches } from '@/application/spaces'
import {
  AppFrame,
  NavAvatar,
  SidebarHeader,
  SidebarSearch,
  SidebarSection
} from '@/ds/AppFrame'
import { FilterListIcon } from '@/ds/FilterListIcon'
import { NavDestination } from '@/ds/NavDestination'
import { AppFeedback } from '@/ui/feedback/AppFeedback'
import { useI18n } from '@/ui/i18n/useI18n'
import { CreateSpaceDialog } from '@/ui/home/CreateSpaceDialog'
import { PlatformBar } from '@/ui/shell/PlatformBar'
import { useBadges } from '@/ui/space/Badges'
import { EmbeddedApps } from '@/ui/space/EmbeddedApps'
import { useSpaceList, useSpaces } from '@/ui/spaces/queries'

export function AppShell(): ReactElement {
  const { t } = useI18n()
  const [creating, setCreating] = useState(false)
  // Null while the search is closed.
  const [query, setQuery] = useState<string | null>(null)
  const home = useMatch('/') !== null

  return (
    <AppFrame
      topBar={<PlatformBar />}
      bare={home}
      sidebar={
        <>
          <SidebarHeader
            title={t('shell.title')}
            action={
              <>
                <IconButton
                  aria-label={t('shell.searchSpaces')}
                  aria-pressed={query !== null}
                  onClick={() => {
                    setQuery(query === null ? '' : null)
                  }}
                >
                  <Icon icon={FilterListIcon} size={24} />
                </IconButton>
                <IconButton
                  aria-label={t('spaces.create')}
                  onClick={() => {
                    setCreating(true)
                  }}
                >
                  <Icon icon={Plus} />
                </IconButton>
              </>
            }
          />
          {query !== null && (
            <SidebarSearch>
              <SearchBar
                elevation={0}
                placeholder={t('shell.spaceName')}
                value={query}
                onChange={event => {
                  setQuery(event.target.value)
                }}
                onClear={() => {
                  setQuery('')
                }}
                componentsProps={{
                  inputBase: {
                    autoFocus: true,
                    onKeyDown: event => {
                      if (event.key === 'Escape') setQuery(null)
                    }
                  }
                }}
              />
            </SidebarSearch>
          )}
          <AppNav />
          <SpaceList query={query ?? ''} />
        </>
      }
    >
      <Outlet />
      <EmbeddedApps />
      <AppFeedback />
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
      <NavItem>
        <RouteNavLink to="/settings/api-tokens">
          <NavIcon icon={Key} />
          <NavText>{t('apiTokens.title')}</NavText>
        </RouteNavLink>
      </NavItem>
    </Nav>
  )
}

function SpaceList({ query }: { query: string }): ReactElement | null {
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
      {!spaces.some(space => nameMatches(space.name, query)) && (
        <ListItem>
          <ListItemText secondary={t('shell.noSpaceFound')} />
        </ListItem>
      )}
      {spaces.map((space, index) => {
        if (!nameMatches(space.name, query)) return null
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
