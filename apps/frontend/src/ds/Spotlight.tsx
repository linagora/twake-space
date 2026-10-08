import { Icon, Magnifier } from '@linagora/twake-icons'
import {
  Box,
  Dialog,
  InputBase,
  ListItemButton,
  ListItemText,
  Typography
} from '@linagora/twake-mui'
import {
  useId,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode
} from 'react'

// A large dialog high on the screen, a big search field on top, the results
// below and the keys at the bottom, as Spotlight on a Mac. Candidate for
// twake-ui, where Twake Chat's Spotchat has its own copy.
export function Spotlight({
  label,
  placeholder,
  value,
  onChange,
  onKeyDown,
  inputProps,
  hints,
  onClose,
  children
}: {
  label: string
  placeholder: string
  value: string
  onChange: (value: string) => void
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void
  // The combobox attributes of the field
  inputProps: InputHTMLAttributes<HTMLInputElement> & Record<string, unknown>
  hints: readonly { keys: string; label: string }[]
  onClose: () => void
  children: ReactNode
}): ReactElement {
  const titleId = useId()
  return (
    <Dialog
      open
      size="medium"
      aria-labelledby={titleId}
      onClose={onClose}
      slotProps={{
        paper: {
          sx: {
            // The same height whatever the number of results: the field
            // never jumps
            height: 'min(70vh, 640px)',
            alignSelf: 'flex-start',
            mt: '12vh',
            borderRadius: '16px',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }
        }
      }}
    >
      <Typography
        id={titleId}
        component="h2"
        variant="h6"
        sx={{ px: 2.5, pt: 2 }}
      >
        {label}
      </Typography>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: 2.5,
          py: 2,
          borderBottom: 1,
          borderColor: 'divider',
          color: 'text.secondary'
        }}
      >
        <Icon icon={Magnifier} size={24} />
        <InputBase
          fullWidth
          autoComplete="off"
          placeholder={placeholder}
          value={value}
          inputProps={{ 'aria-label': label, autoFocus: true, ...inputProps }}
          sx={{ fontSize: 20, color: 'text.primary' }}
          onChange={event => {
            onChange(event.target.value)
          }}
          onKeyDown={onKeyDown}
        />
      </Box>
      <Box sx={{ flex: 1, overflowY: 'auto', py: 1 }}>{children}</Box>
      <Box
        aria-hidden
        sx={{
          display: 'flex',
          gap: 2,
          px: 2.5,
          py: 1,
          borderTop: 1,
          borderColor: 'divider',
          bgcolor: 'background.default'
        }}
      >
        {hints.map(hint => (
          <Typography
            key={hint.keys}
            variant="caption"
            color="text.secondary"
            sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}
          >
            <Box
              component="kbd"
              sx={{
                px: 0.75,
                borderRadius: '6px',
                border: 1,
                borderColor: 'divider',
                bgcolor: 'background.paper',
                fontFamily: 'inherit'
              }}
            >
              {hint.keys}
            </Box>
            {hint.label}
          </Typography>
        ))}
      </Box>
    </Dialog>
  )
}

export function SpotlightEmpty({ text }: { text: string }): ReactElement {
  return (
    <Typography color="text.secondary" sx={{ px: 2.5, py: 1 }}>
      {text}
    </Typography>
  )
}

// An option of the listbox: the focus stays in the field, which points at
// the selected row by its id.
export function SpotlightOption({
  id,
  selected,
  label,
  avatar,
  primary,
  secondary,
  count,
  onClick
}: {
  id: string
  selected: boolean
  // Names the option, when its text alone does not
  label?: string | undefined
  avatar: ReactNode
  primary: string
  secondary?: string | undefined
  count: string | null
  onClick: () => void
}): ReactElement {
  return (
    <ListItemButton
      id={id}
      role="option"
      aria-selected={selected}
      aria-label={label}
      selected={selected}
      tabIndex={-1}
      onClick={onClick}
      sx={{ gap: 1.5, px: 2.5 }}
    >
      {avatar}
      <ListItemText
        primary={primary}
        secondary={secondary}
        slotProps={{ secondary: { noWrap: true } }}
      />
      {count !== null && (
        <Typography variant="caption" color="primary" aria-hidden>
          {count}
        </Typography>
      )}
    </ListItemButton>
  )
}
