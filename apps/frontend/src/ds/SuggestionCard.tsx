import { Cross, Icon } from '@linagora/twake-icons'
import { TWAKE_BAR_HEIGHT } from '@linagora/twake-bar'
import {
  Alert,
  Card,
  IconButton,
  Stack,
  Typography,
  styled
} from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'

// Top right, over the page; the cards take the clicks, the gaps between them none.
const Overlay = styled('section')({
  position: 'fixed',
  top: `calc(${TWAKE_BAR_HEIGHT} + 12px)`,
  right: 12,
  zIndex: 1200,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  width: 'min(360px, calc(100vw - 24px))',
  pointerEvents: 'none',
  '& > *': { pointerEvents: 'auto' }
})

export function SuggestionStack({
  label,
  children
}: {
  label: string
  children: ReactNode
}): ReactElement {
  return (
    <Overlay aria-label={label} aria-live="polite">
      {children}
    </Overlay>
  )
}

// Shown without stealing the focus: it is a suggestion, not a question.
export function SuggestionCard({
  text,
  close,
  error,
  actions
}: {
  text: string
  close: { label: string; onClick: () => void }
  error?: string | null
  actions?: ReactNode
}): ReactElement {
  return (
    <Card sx={{ p: 2 }}>
      <Stack direction="row" sx={{ gap: 1, alignItems: 'flex-start' }}>
        <Typography variant="body2" sx={{ flex: 1 }}>
          {text}
        </Typography>
        <IconButton
          size="small"
          aria-label={close.label}
          onClick={close.onClick}
        >
          <Icon icon={Cross} />
        </IconButton>
      </Stack>
      {actions && (
        <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap', mt: 1.5 }}>
          {actions}
        </Stack>
      )}
      {error && (
        <Alert severity="error" sx={{ mt: 1.5 }}>
          {error}
        </Alert>
      )}
    </Card>
  )
}
