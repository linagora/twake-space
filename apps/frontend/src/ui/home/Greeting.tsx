import { Calendar, Icon } from '@linagora/twake-icons'
import { Typography } from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'

import { useI18n } from '@/ui/i18n/useI18n'
import { useSession } from '@/ui/session/SessionGate'
import { useCommonSettings } from '@/ui/settings/useCommonSettings'

function greetingKey(hour: number): 'morning' | 'afternoon' | 'evening' {
  if (hour < 12) return 'morning'
  if (hour < 18) return 'afternoon'
  return 'evening'
}

// `level` is the greeting's heading level: the page may already have an h1.
export function Greeting({
  title,
  level,
  hideTitleOnMobile = false
}: {
  title: ReactNode
  level: 'h1' | 'h2'
  hideTitleOnMobile?: boolean
}): ReactElement {
  const { t, lang } = useI18n()
  const { user } = useSession()
  const { settings } = useCommonSettings()
  const timeZone = settings.timezone ?? undefined
  const now = new Date()
  const hour = Number(
    new Intl.DateTimeFormat('en', {
      hour: 'numeric',
      hourCycle: 'h23',
      timeZone
    }).format(now)
  )
  const name =
    (settings.displayName ?? user.name)?.split(' ')[0] ??
    user.email?.split('@')[0] ??
    ''

  return (
    <>
      <div className="u-flex u-flex-wrap u-flex-items-center u-flex-justify-between">
        <Typography
          variant="h3"
          component="p"
          className={hideTitleOnMobile ? 'u-dn-m' : undefined}
        >
          {title}
        </Typography>
        <Typography
          variant="subtitle1"
          component="p"
          className="u-flex u-flex-items-center"
        >
          <Icon icon={Calendar} className="u-mr-half" />
          {new Intl.DateTimeFormat(lang, {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            timeZone
          }).format(now)}
        </Typography>
      </div>
      <Typography variant="h2" component={level} className="u-mt-1 u-mb-1-half">
        {t(`home.${greetingKey(hour)}`, { name })}
      </Typography>
    </>
  )
}
