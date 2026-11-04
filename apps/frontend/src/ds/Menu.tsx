import { Icon, type IconProps } from '@linagora/twake-icons'
import {
  BottomSheet,
  BottomSheetItem,
  Button,
  Divider,
  ListItemIcon,
  ListItemText,
  MenuItem,
  MenuList
} from '@linagora/twake-mui'
import { useEffect, useState, type ReactElement, type ReactNode } from 'react'

import { ChevronDownIcon } from '@/ds/icons'

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

// A menu that rises from the bottom of a phone's screen, with a handle to
// drag it by. Its backdrop, a swipe down or Escape closes it.
export function MenuSheet({
  label,
  onClose,
  children
}: {
  label: string
  onClose: () => void
  children: ReactNode
}): ReactElement {
  // Unlike a menu, the sheet is no modal: focus goes back to its opener by hand
  const [opener] = useState(() => document.activeElement)
  useEffect(
    () => () => {
      if (opener instanceof HTMLElement) opener.focus()
    },
    [opener]
  )
  return (
    <BottomSheet backdrop onClose={onClose}>
      <BottomSheetItem disableGutters disableElevation>
        <MenuList
          autoFocusItem
          aria-label={label}
          onKeyDown={event => {
            if (event.key === 'Escape') onClose()
          }}
          sx={{ pt: 0 }}
        >
          {children}
        </MenuList>
      </BottomSheetItem>
    </BottomSheet>
  )
}

// The button that opens a menu sheet to pick from, showing the current pick.
export function SheetSelect({
  icon,
  open,
  onClick,
  compact = false,
  'aria-label': ariaLabel,
  children
}: {
  icon: ReactNode
  open: boolean
  onClick: () => void
  /** Borderless and only as wide as its label, for a one line header. */
  compact?: boolean
  'aria-label'?: string | undefined
  children: ReactNode
}): ReactElement {
  return (
    <Button
      variant={compact ? 'text' : 'outlined'}
      color="inherit"
      fullWidth={!compact}
      aria-haspopup="menu"
      aria-expanded={open}
      aria-label={ariaLabel}
      startIcon={icon}
      endIcon={<Icon icon={ChevronDownIcon} />}
      onClick={onClick}
      sx={{
        justifyContent: 'flex-start',
        minHeight: compact ? 40 : 48,
        px: compact ? 1 : 2,
        borderRadius: '4px',
        borderColor: 'divider',
        fontWeight: 400,
        '& .MuiButton-endIcon': {
          ml: compact ? 0.5 : 'auto',
          color: 'text.secondary'
        },
        '& .MuiButton-startIcon': { color: 'text.secondary' }
      }}
    >
      {children}
    </Button>
  )
}
