import {
  CheckList,
  Cloud,
  Comment,
  Email,
  Icon,
  type IconProps
} from '@linagora/twake-icons'
import { useState, type ReactElement } from 'react'
import { useNavigate } from 'react-router'

import { badgeLabel, tabCount } from '@/application/badges'
import { embeddedApp } from '@/application/embeddedApps'
import type { Space } from '@/application/spaces'
import type { Tab, TabState } from '@/application/spaceTabs'
import { CountedLabel } from '@/ds/CountedLabel'
import { CalendarIcon, Home, RssFeedIcon } from '@/ds/icons'
import { MenuEntry, MenuSheet, SheetSelect } from '@/ds/Menu'
import { useI18n } from '@/ui/i18n/useI18n'
import { useBadges } from '@/ui/space/Badges'

const TAB_ICONS: Record<Tab, IconProps['icon']> = {
  home: Home,
  feed: RssFeedIcon,
  chat: Comment,
  tasks: CheckList,
  drive: Cloud,
  mail: Email,
  calendar: CalendarIcon
}

// A phone's tabs: the open one, and a sheet to move to another.
export function TabSheet({
  space,
  tabs,
  current
}: {
  space: Space
  tabs: { tab: Tab; state: TabState }[]
  current: Tab
}): ReactElement {
  const { t } = useI18n()
  const navigate = useNavigate()
  const badges = useBadges()
  const [open, setOpen] = useState(false)
  const close = (): void => {
    setOpen(false)
  }
  const named = (tab: Tab) => {
    const app = embeddedApp(tab)
    const count = app ? tabCount(badges, space, app.app) : 0
    const name = t(`tabs.${tab}`)
    return {
      label: <CountedLabel label={name} count={badgeLabel(count)} />,
      ariaLabel:
        count > 0
          ? t('tabs.withCount', { app: name, smart_count: count })
          : undefined
    }
  }
  const shown = named(current)
  return (
    <>
      <SheetSelect
        icon={<Icon icon={TAB_ICONS[current]} />}
        open={open}
        aria-label={shown.ariaLabel}
        onClick={() => {
          setOpen(true)
        }}
      >
        {shown.label}
      </SheetSelect>
      {open && (
        <MenuSheet label={t('tabs.choose')} onClose={close}>
          {tabs.map(item => {
            const { label, ariaLabel } = named(item.tab)
            return (
              <MenuEntry
                key={item.tab}
                icon={<Icon icon={TAB_ICONS[item.tab]} />}
                selected={item.tab === current}
                disabled={item.state === 'off'}
                aria-label={ariaLabel}
                onClick={() => {
                  close()
                  // The open tab keeps where its frame went, as with the tabs
                  if (item.tab !== current) {
                    void navigate(`/spaces/${space.id}/${item.tab}`)
                  }
                }}
              >
                {label}
              </MenuEntry>
            )
          })}
        </MenuSheet>
      )}
    </>
  )
}
