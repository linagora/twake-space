import { Archive, Icon, Magnifier, Trash } from '@linagora/twake-icons'
import {
  List,
  ListItem,
  ListItemText,
  NavIcon,
  NavItem,
  NavLink,
  NavText,
  SearchBar
} from '@linagora/twake-mui'
import { NewVersionDialog } from '@linagora/twake-react-new-version'
import {
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode
} from 'react'
import {
  Outlet,
  NavLink as RouterNavLink,
  useLocation,
  useMatch
} from 'react-router'

import { badgeLabel } from '@/application/badges'
import {
  nameMatches,
  pinnedAndRecent,
  type SpaceSummary
} from '@/application/spaces'
import {
  AppFrame,
  NavAvatar,
  SidebarDivider,
  SidebarHeader,
  SidebarNav,
  SidebarSearch,
  SidebarSection,
  useNarrowScreen
} from '@/ds/AppFrame'
import { FilterListIcon } from '@/ds/FilterListIcon'
import { IconButton } from '@/ds/IconButton'
import { AddIcon, SpaceCubeIcon } from '@/ds/icons'
import { NavDestination } from '@/ds/NavDestination'
import { AssistantContext, AssistantPanel } from '@/ui/assistant/AssistantPanel'
import { CallProvider } from '@/ui/call/CallContext'
import { CallWindow } from '@/ui/call/CallWindow'
import { Suggestions } from '@/ui/assistant/Suggestions'
import { AppFeedback } from '@/ui/feedback/AppFeedback'
import { useI18n } from '@/ui/i18n/useI18n'
import { CreateSpaceDialog } from '@/ui/home/CreateSpaceDialog'
import { HomeAssistant } from '@/ui/home/HomeAssistant'
import { PlatformBar } from '@/ui/shell/PlatformBar'
import { SpotSpace } from '@/ui/shell/SpotSpace'
import { useSpaceTotals } from '@/ui/space/Badges'
import { ChatFavourites } from '@/ui/space/ChatFavourites'
import { EmbeddedApps } from '@/ui/space/EmbeddedApps'
import { useFillPage } from '@/ui/space/FillPage'
import { useSession } from '@/ui/session/SessionGate'
import { useSpaceList } from '@/ui/spaces/queries'
import { NotificationPermissionPrompt } from '@/ui/shell/NotificationPermissionPrompt'

export function AppShell(): ReactElement {
  const { t } = useI18n()
  const { sdk } = useSession()
  const [creating, setCreating] = useState(false)
  // Null while the search is closed.
  const [query, setQuery] = useState<string | null>(null)
  const home = useMatch('/') !== null
  // The assistant stays open from one space to the next, and to the home.
  const [assistantOpen, setAssistantOpen] = useState(false)
  const closeAssistant = (): void => {
    setAssistantOpen(false)
  }
  const spaceId = useMatch('/spaces/:spaceId/*')?.params.spaceId
  // A space's content may take the whole page, the platform bar's too
  const alone = useFillPage().space !== null
  const narrow = useNarrowScreen()
  const [spotting, setSpotting] = useState(false)
  // The menu of narrow screens is open on the page it was opened from: it
  // closes when another page opens.
  const { key } = useLocation()
  const [menuAt, setMenuAt] = useState<string | null>(null)
  // Forgotten once left: going back to that page, or a screen narrowed again
  // after widening, would open it on its own
  if (menuAt !== null && (menuAt !== key || !narrow)) setMenuAt(null)
  const afterMenu = useRef<(() => void) | null>(null)
  const fromMenu = (open: () => void): void => {
    if (menuAt === key) {
      afterMenu.current = open
      setMenuAt(null)
    } else {
      open()
    }
  }

  return (
    <CallProvider>
      <AppFrame
        // Without a platform client there is no bar, and no room to leave for it
        topBar={sdk ? <PlatformBar /> : undefined}
        menu={{
          label: t('shell.menu'),
          open: menuAt === key,
          setOpen: open => {
            setMenuAt(open ? key : null)
          },
          onClosed: () => {
            afterMenu.current?.()
            afterMenu.current = null
          }
        }}
        bare={home}
        alone={alone}
        aside={
          assistantOpen &&
          (spaceId !== undefined ? (
            <AssistantPanel spaceId={spaceId} onClose={closeAssistant} />
          ) : (
            home && <HomeAssistant onClose={closeAssistant} />
          ))
        }
        sidebar={
          <>
            <SidebarHeader
              title={t('shell.title')}
              action={
                <>
                  <IconButton
                    size="medium"
                    label={t('shell.searchSpaces')}
                    aria-pressed={query !== null}
                    onClick={() => {
                      setQuery(query === null ? '' : null)
                    }}
                  >
                    <Icon icon={FilterListIcon} size={24} />
                  </IconButton>
                  <IconButton
                    size="medium"
                    color="primary"
                    label={t('spaces.create')}
                    onClick={() => {
                      fromMenu(() => {
                        setCreating(true)
                      })
                    }}
                  >
                    <Icon icon={AddIcon} size={24} />
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
            <AppNav
              narrow={narrow}
              onSearch={() => {
                fromMenu(() => {
                  setSpotting(true)
                })
              }}
            />
            <SpaceList query={query ?? ''} />
            <ShelfLinks />
          </>
        }
      >
        <AssistantContext
          value={{ open: assistantOpen, setOpen: setAssistantOpen }}
        >
          <PageTop />
          <Outlet />
        </AssistantContext>
        <EmbeddedApps />
        <ChatFavourites />
        <SpotSpace isOpen={spotting} setIsOpen={setSpotting} />
        <NotificationPermissionPrompt />
        <CallWindow />
        <AppFeedback />
        <NewVersionDialog running={__BUILD_ID__} appName="Twake Space" />
        <Suggestions />
        {creating && (
          <CreateSpaceDialog
            onClose={() => {
              setCreating(false)
            }}
          />
        )}
      </AppFrame>
    </CallProvider>
  )
}

// Below lg the page scrolls as a whole: another screen or tab opens at its
// top. The path within a tab is the framed app's own. Before the outlet, so
// a feed opening on its newest items scrolls after this.
function PageTop(): null {
  const screen = useLocation().pathname.split('/').slice(0, 4).join('/')
  useLayoutEffect(() => {
    window.scrollTo(0, 0)
  }, [screen])
  return null
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

// A phone has no Ctrl+K, so its menu gets a Search entry
function AppNav({
  narrow,
  onSearch
}: {
  narrow: boolean
  onSearch: () => void
}): ReactElement {
  const { t } = useI18n()

  return (
    <SidebarNav>
      <NavItem>
        <RouteNavLink to="/" end>
          <NavIcon icon={SpaceCubeIcon} />
          <NavText>{t('shell.allSpaces')}</NavText>
        </RouteNavLink>
      </NavItem>
      {narrow && (
        <NavItem>
          <NavLink onClick={onSearch}>
            <NavIcon icon={Magnifier} />
            <NavText>{t('shell.search')}</NavText>
          </NavLink>
        </NavItem>
      )}
    </SidebarNav>
  )
}

// Pinned and Recent, or every space whose name holds the filter while one is
// typed.
function SpaceList({ query }: { query: string }): ReactElement | null {
  const { t } = useI18n()
  const spaces = useSpaceList().data ?? []
  const totals = useSpaceTotals(spaces)
  if (spaces.length === 0) return null

  if (query.trim() !== '') {
    const found = spaces.filter(space => nameMatches(space.name, query))
    return (
      <SidebarSection label={t('shell.yourSpaces')}>
        {found.length === 0 && <Hint text={t('shell.noSpaceFound')} />}
        <SpaceLinks spaces={found} totals={totals} />
      </SidebarSection>
    )
  }

  // Recent shows even empty, with a hint, so people learn it exists.
  const { pinned, recent } = pinnedAndRecent(spaces)
  return (
    <>
      {pinned.length > 0 && (
        <SidebarSection label={t('shell.pinned')}>
          <SpaceLinks spaces={pinned} totals={totals} />
        </SidebarSection>
      )}
      <SidebarSection label={t('shell.recent')}>
        {recent.length === 0 && <Hint text={t('shell.noRecent')} />}
        <SpaceLinks spaces={recent} totals={totals} />
      </SidebarSection>
    </>
  )
}

function Hint({ text }: { text: string }): ReactElement {
  return (
    <ListItem>
      <ListItemText secondary={text} />
    </ListItem>
  )
}

function ShelfLinks(): ReactElement {
  const { t } = useI18n()
  return (
    <>
      <SidebarDivider />
      <List aria-label={t('shell.shelves')}>
        <NavItem>
          <RouteNavLink to="/archives">
            <NavIcon icon={Archive} />
            <NavText>{t('shell.archives')}</NavText>
          </RouteNavLink>
        </NavItem>
        <NavItem>
          <RouteNavLink to="/bin">
            <NavIcon icon={Trash} />
            <NavText>{t('shell.bin')}</NavText>
          </RouteNavLink>
        </NavItem>
      </List>
    </>
  )
}

function SpaceLinks({
  spaces,
  totals
}: {
  spaces: SpaceSummary[]
  totals: Map<string, number>
}): ReactElement {
  const { t } = useI18n()
  return (
    <>
      {spaces.map(space => {
        const total = totals.get(space.id) ?? 0
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
    </>
  )
}
