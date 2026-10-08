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

export function useGreeting(): { date: string; greeting: string } {
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
  return {
    date: new Intl.DateTimeFormat(lang, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      timeZone
    }).format(now),
    greeting: t(`home.${greetingKey(hour)}`, { name })
  }
}

export function Greeting({ title }: { title: ReactNode }): ReactElement {
  const { date, greeting } = useGreeting()

  return (
    <>
      <div className="u-flex u-flex-wrap u-flex-items-center u-flex-justify-between">
        {/* Below lg the mobile bar already shows the app name */}
        <Typography variant="h3" component="p" className="u-dn-m">
          {title}
        </Typography>
        <Typography
          variant="subtitle1"
          component="p"
          className="u-flex u-flex-items-center u-ml-auto"
        >
          <Icon icon={Calendar} className="u-mr-half" />
          {date}
        </Typography>
      </div>
      <Typography variant="h2" component="h1" className="u-mt-1 u-mb-1-half">
        {greeting}
      </Typography>
    </>
  )
}
