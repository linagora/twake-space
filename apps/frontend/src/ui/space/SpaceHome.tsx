import { Button } from '@linagora/twake-mui'
import { useState, type ReactElement } from 'react'
import { Link as RouterLink } from 'react-router'

import { badgeLabel, tabCount } from '@/application/badges'
import type { Space, SpaceApp } from '@/application/spaces'
import type { Tab, TabState } from '@/application/spaceTabs'
import chatArt from '@/assets/home-chat.svg'
import driveArt from '@/assets/home-drive.svg'
import mailArt from '@/assets/home-mail.svg'
import tasksArt from '@/assets/home-tasks.svg'
import { NameAvatar } from '@/ds/AppFrame'
import {
  AppArt,
  AppCard,
  CalendarLeaf,
  MemberAvatars,
  Tile,
  TileGrid,
  TileNumber
} from '@/ds/Card'
import { ScrollPanel, SpaceCover } from '@/ds/Page'
import { Greeting } from '@/ui/home/Greeting'
import { useI18n } from '@/ui/i18n/useI18n'
import { useBadges } from '@/ui/space/Badges'
import { PeopleDialog } from '@/ui/space/PeopleDialog'
import { useCommonSettings } from '@/ui/settings/useCommonSettings'
import { AppIcon } from '@/ui/spaces/AppPicker'

// In the mockup's order
const CARDS: readonly SpaceApp[] = [
  'calendar',
  'mail',
  'chat',
  'drive',
  'tasks'
]

const ART: Record<Exclude<SpaceApp, 'calendar'>, string> = {
  mail: mailArt,
  chat: chatArt,
  drive: driveArt,
  tasks: tasksArt
}

function Today(): ReactElement {
  const { lang } = useI18n()
  const { settings } = useCommonSettings()
  const timeZone = settings.timezone ?? undefined
  const now = new Date()
  const part = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(lang, { ...options, timeZone }).format(now)
  return (
    <CalendarLeaf
      weekday={part({ weekday: 'long' })}
      day={part({ day: 'numeric' })}
      month={part({ month: 'long' })}
    />
  )
}

export function SpaceHome({
  space,
  tabs
}: {
  space: Space
  tabs: { tab: Tab; state: TabState }[]
}): ReactElement {
  const { t } = useI18n()
  const badges = useBadges()
  const [managing, setManaging] = useState(false)
  const apps = CARDS.flatMap(app => {
    const state = tabs.find(item => item.tab === app)?.state
    return state ? [{ app, state }] : []
  })
  const members = space.members.length

  return (
    <ScrollPanel>
      <SpaceCover />
      <div>
        <Greeting title={space.name} level="h2" />
      </div>
      <TileGrid min={360}>
        <Tile>
          <TileNumber
            value={members}
            label={t('spaceHome.users', { smart_count: members })}
          />
          {members > 0 && (
            <MemberAvatars>
              {space.members.map(member => {
                const name = member.displayName ?? member.username
                return (
                  <NameAvatar
                    key={member.id}
                    name={name}
                    label={name}
                    size="s"
                  />
                )
              })}
            </MemberAvatars>
          )}
          {space.role === 'admin' && (
            <Button
              variant="outlined"
              onClick={() => {
                setManaging(true)
              }}
            >
              {t('spaceHome.manageUsers')}
            </Button>
          )}
        </Tile>
      </TileGrid>
      <TileGrid min={320}>
        {apps.map(({ app, state }) => {
          const name = t(`spaceHome.app.${app}.name`)
          const open = t(`spaceHome.app.${app}.open`)
          const count = tabCount(badges, space, app)
          return (
            <AppCard
              key={app}
              visual={
                app === 'calendar' ? <Today /> : <AppArt src={ART[app]} />
              }
              icon={<AppIcon app={app} size={16} />}
              name={name}
              nameLabel={
                count > 0
                  ? t('tabs.withCount', { app: name, smart_count: count })
                  : undefined
              }
              count={badgeLabel(count)}
              description={t(`spaceHome.app.${app}.description`)}
              action={
                state === 'off' ? (
                  <Button variant="outlined" disabled>
                    {open}
                  </Button>
                ) : (
                  <Button
                    variant="outlined"
                    component={RouterLink}
                    to={`/spaces/${space.id}/${app}`}
                  >
                    {open}
                  </Button>
                )
              }
            />
          )
        })}
      </TileGrid>
      {managing && (
        <PeopleDialog
          space={space}
          onClose={() => {
            setManaging(false)
          }}
        />
      )}
    </ScrollPanel>
  )
}
