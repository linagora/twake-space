import { TextField } from '@linagora/twake-mui'
import type { ReactElement } from 'react'

import { SPACE_ROLES, type SpaceRole } from '@/application/spaces'
import { useI18n } from '@/ui/i18n/useI18n'

export function RoleSelect({
  label,
  value,
  onChange,
  hiddenLabel = true
}: {
  label: string
  value: SpaceRole
  onChange: (role: SpaceRole) => void
  hiddenLabel?: boolean
}): ReactElement {
  const { t } = useI18n()
  return (
    <TextField
      select
      size="small"
      value={value}
      onChange={event => {
        onChange(event.target.value as SpaceRole)
      }}
      slotProps={{
        select: { native: true },
        htmlInput: hiddenLabel ? { 'aria-label': label } : {}
      }}
      {...(hiddenLabel ? {} : { label })}
    >
      {SPACE_ROLES.map(role => (
        <option key={role} value={role}>
          {t(`roles.${role}`)}
        </option>
      ))}
    </TextField>
  )
}
