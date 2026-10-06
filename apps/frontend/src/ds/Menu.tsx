import { ListItemIcon, ListItemText, MenuItem } from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'

// A menu entry with its icon; `danger` paints a destructive one in error.
export function MenuEntry({
  icon,
  children,
  onClick,
  danger = false
}: {
  icon: ReactNode
  children: ReactNode
  onClick: () => void
  danger?: boolean
}): ReactElement {
  return (
    <MenuItem onClick={onClick} sx={danger ? { color: 'error.main' } : null}>
      <ListItemIcon sx={danger ? { color: 'inherit' } : null}>
        {icon}
      </ListItemIcon>
      <ListItemText>{children}</ListItemText>
    </MenuItem>
  )
}
