import { DropdownButton, Menu, MenuItem } from '@linagora/twake-mui'
import { useState, type ReactElement } from 'react'

import { SPACE_ROLES, type SpaceRole } from '@/application/spaces'
import { useI18n } from '@/ui/i18n/useI18n'

export function RoleMenu({
  label,
  value,
  onChange
}: {
  label: string
  value: SpaceRole
  onChange: (role: SpaceRole) => void
}): ReactElement {
  const { t } = useI18n()
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const close = (): void => {
    setAnchor(null)
  }
  return (
    <>
      <DropdownButton
        textVariant="body2"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={anchor !== null}
        onClick={event => {
          setAnchor(event.currentTarget)
        }}
        className="u-m-0 u-flex-none"
        dropdownTextProps={{ color: 'textSecondary' }}
      >
        {t(`roles.${value}`)}
      </DropdownButton>
      <Menu anchorEl={anchor} open={anchor !== null} onClose={close}>
        {SPACE_ROLES.map(role => (
          <MenuItem
            key={role}
            selected={role === value}
            onClick={() => {
              close()
              if (role !== value) onChange(role)
            }}
          >
            {t(`roles.${role}`)}
          </MenuItem>
        ))}
      </Menu>
    </>
  )
}
