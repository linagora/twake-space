import { Icon, type IconProps } from '@linagora/twake-icons'
import {
  Divider,
  ListItemIcon,
  ListItemText,
  MenuItem
} from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'

// A menu entry with its icon; `danger` paints a destructive one in error.
export function MenuEntry({
  icon,
  children,
  onClick,
  danger = false,
  selected = false,
  disabled = false,
  'aria-label': ariaLabel
}: {
  icon: ReactNode
  children: ReactNode
  onClick: () => void
  danger?: boolean
  selected?: boolean
  disabled?: boolean
  'aria-label'?: string | undefined
}): ReactElement {
  return (
    <MenuItem
      onClick={onClick}
      selected={selected}
      disabled={disabled}
      aria-label={ariaLabel}
      sx={
        danger
          ? {
              color: 'error.main',
              '& .MuiListItemIcon-root': { color: 'inherit' }
            }
          : null
      }
    >
      <ListItemIcon>{icon}</ListItemIcon>
      <ListItemText>{children}</ListItemText>
    </MenuItem>
  )
}

export interface MenuAction {
  key: string
  icon: IconProps['icon']
  label: string
  onClick: () => void
  danger?: boolean
}

// An array, not a fragment: the menu's keyboard only reaches its own children.
export function menuEntries(
  groups: MenuAction[][],
  close: () => void
): ReactElement[] {
  return groups
    .filter(group => group.length > 0)
    .flatMap((group, index) => [
      ...(index > 0 ? [<Divider key={`divider-${String(index)}`} />] : []),
      ...group.map(entry => (
        <MenuEntry
          key={entry.key}
          icon={<Icon icon={entry.icon} />}
          danger={entry.danger ?? false}
          onClick={() => {
            close()
            entry.onClick()
          }}
        >
          {entry.label}
        </MenuEntry>
      ))
    ])
}
