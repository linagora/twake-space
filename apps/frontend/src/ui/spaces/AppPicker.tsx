import { CalendarApp, Chat, Drive, Icon, Mail } from '@linagora/twake-icons'
import { Checkbox, FormControlLabel, Grid, Stack } from '@linagora/twake-mui'
import type { ReactElement } from 'react'

import type { SpaceApp } from '@/application/spaces'
import tasksTile from '@/assets/tasks.svg'
import { useI18n } from '@/ui/i18n/useI18n'

const ICONS = { drive: Drive, chat: Chat, calendar: CalendarApp, mail: Mail }

export function AppIcon({
  app,
  size = 24
}: {
  app: SpaceApp
  size?: number
}): ReactElement {
  return app === 'tasks' ? (
    <img src={tasksTile} alt="" width={size} height={size} />
  ) : (
    <Icon icon={ICONS[app]} size={size} />
  )
}

// A new space has the first column on and the second one off.
export const DEFAULT_APPS: SpaceApp[] = ['drive', 'chat', 'tasks']
const OTHER_APPS: SpaceApp[] = ['calendar', 'mail']

export function AppPicker({
  provided,
  picked,
  onChange,
  labelledBy
}: {
  provided: readonly SpaceApp[]
  picked: ReadonlySet<SpaceApp>
  onChange: (picked: ReadonlySet<SpaceApp>) => void
  labelledBy: string
}): ReactElement {
  const { t } = useI18n()

  const toggle = (app: SpaceApp, checked: boolean): void => {
    const next = new Set(picked)
    if (checked) next.add(app)
    else next.delete(app)
    onChange(next)
  }

  const column = (apps: SpaceApp[]): ReactElement => (
    <Grid size={{ xs: 12, sm: 6 }}>
      <Stack spacing={1}>
        {apps
          .filter(app => provided.includes(app))
          .map(app => (
            <FormControlLabel
              key={app}
              control={
                <Checkbox
                  checked={picked.has(app)}
                  onChange={(_event, checked) => {
                    toggle(app, checked)
                  }}
                />
              }
              label={
                <span className="u-flex u-flex-items-center u-ml-half">
                  <AppIcon app={app} />
                  <span className="u-ml-half">
                    {t(`createSpace.app.${app}`)}
                  </span>
                </span>
              }
              slotProps={{ typography: { variant: 'body2' } }}
            />
          ))}
      </Stack>
    </Grid>
  )

  return (
    <Grid container columnSpacing={3} role="group" aria-labelledby={labelledBy}>
      {column(DEFAULT_APPS)}
      {column(OTHER_APPS)}
    </Grid>
  )
}
