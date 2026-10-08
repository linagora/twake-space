import {
  Box,
  Card,
  Radio,
  RadioGroup,
  Stack,
  Typography
} from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'

const RADIUS = '20px'

// The chrome of the frame's side panel: a title row with its actions, and
// a column the content fills.
export function SidePanel({
  title,
  actions,
  children
}: {
  title: string
  actions: ReactNode
  children: ReactNode
}): ReactElement {
  return (
    <>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          pl: 2,
          pr: 1,
          py: 1
        }}
      >
        <Typography
          variant="subtitle1"
          component="h2"
          noWrap
          sx={{ flex: '1 1 auto', minWidth: 0 }}
        >
          {title}
        </Typography>
        {actions}
      </Box>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          flex: '1 1 auto',
          minHeight: 0
        }}
      >
        {children}
      </Box>
    </>
  )
}

// The main column, and a narrower one that stays in view beside it on wide
// screens and drops below it on narrow ones.
export function SplitLayout({
  main,
  aside
}: {
  main: ReactNode
  aside: ReactNode
}): ReactElement {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 360px' },
        gap: 3,
        alignItems: 'start'
      }}
    >
      <Box sx={{ minWidth: 0 }}>{main}</Box>
      <Box sx={{ position: { lg: 'sticky' }, top: { lg: 16 } }}>{aside}</Box>
    </Box>
  )
}

export function Panel({
  titleId,
  title,
  children
}: {
  titleId: string
  title: string
  children: ReactNode
}): ReactElement {
  return (
    <Card
      component="section"
      aria-labelledby={titleId}
      sx={{ borderRadius: RADIUS, p: 2.5 }}
    >
      <Typography id={titleId} variant="h5" component="h2" sx={{ mb: 2 }}>
        {title}
      </Typography>
      <Stack spacing={2}>{children}</Stack>
    </Card>
  )
}

export function Steps({ children }: { children: ReactNode }): ReactElement {
  return (
    <Stack
      component="ol"
      spacing={1.5}
      sx={{ m: 0, p: 0, listStyle: 'none', counterReset: 'step' }}
    >
      {children}
    </Stack>
  )
}

export function Step({ children }: { children: ReactNode }): ReactElement {
  return (
    <Typography
      component="li"
      variant="body2"
      sx={{
        display: 'flex',
        gap: 1.5,
        counterIncrement: 'step',
        '&::before': {
          content: 'counter(step)',
          flex: 'none',
          width: 24,
          height: 24,
          mt: '-2px',
          borderRadius: '50%',
          display: 'grid',
          placeItems: 'center',
          fontSize: 12,
          fontWeight: 600,
          bgcolor: 'primary.main',
          color: 'primary.contrastText'
        }
      }}
    >
      {children}
    </Typography>
  )
}

export function Labelled({
  label,
  children
}: {
  label: string
  children: ReactNode
}): ReactElement {
  return (
    <Stack spacing={0.75}>
      <Typography variant="caption" color="textSecondary" component="p">
        {label}
      </Typography>
      {children}
    </Stack>
  )
}

export function Note({
  icon,
  children
}: {
  icon: ReactNode
  children: ReactNode
}): ReactElement {
  return (
    <Box
      sx={{
        display: 'flex',
        gap: 1.5,
        p: 1.5,
        borderRadius: '12px',
        bgcolor: 'action.hover'
      }}
    >
      <Box sx={{ color: 'primary.main', flex: 'none', display: 'flex' }}>
        {icon}
      </Box>
      <Typography variant="body2" color="textSecondary">
        {children}
      </Typography>
    </Box>
  )
}

// A tinted square holding an icon, the avatar of a thing that has no picture.
export function IconTile({ children }: { children: ReactNode }): ReactElement {
  return (
    <Box
      sx={{
        flex: 'none',
        width: 40,
        height: 40,
        borderRadius: '12px',
        display: 'grid',
        placeItems: 'center',
        color: 'primary.main',
        bgcolor: theme =>
          `color-mix(in srgb, ${theme.palette.primary.main} 12%, transparent)`
      }}
    >
      {children}
    </Box>
  )
}

export function ItemCard({
  icon,
  title,
  meta,
  status,
  chips,
  menu
}: {
  icon: ReactNode
  title: ReactNode
  meta: ReactNode
  status?: ReactNode
  chips?: ReactNode
  menu?: ReactNode
}): ReactElement {
  return (
    <Card
      component="li"
      sx={{
        borderRadius: RADIUS,
        p: 2,
        display: 'flex',
        gap: 1.5,
        transition: 'box-shadow 120ms',
        '&:hover': { boxShadow: 3 }
      }}
    >
      {icon}
      <Box sx={{ flex: '1 1 auto', minWidth: 0 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            flexWrap: 'wrap'
          }}
        >
          <Typography variant="subtitle1" component="p" noWrap>
            {title}
          </Typography>
          {status}
        </Box>
        <Typography variant="caption" color="textSecondary" component="p">
          {meta}
        </Typography>
        {chips && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 1.25 }}>
            {chips}
          </Box>
        )}
      </Box>
      {menu && <Box sx={{ flex: 'none', mt: -0.5, mr: -0.5 }}>{menu}</Box>}
    </Card>
  )
}

export function ItemList({
  labelledBy,
  children
}: {
  labelledBy: string
  children: ReactNode
}): ReactElement {
  return (
    <Stack
      component="ul"
      aria-labelledby={labelledBy}
      spacing={1.5}
      sx={{ m: 0, p: 0, listStyle: 'none' }}
    >
      {children}
    </Stack>
  )
}

export function EmptyCard({
  icon,
  title,
  text,
  action
}: {
  icon: ReactNode
  title: string
  text: string
  action: ReactNode
}): ReactElement {
  return (
    <Box
      sx={{
        borderRadius: RADIUS,
        border: 2,
        borderStyle: 'dashed',
        borderColor: 'divider',
        py: 6,
        px: 3,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 1.5,
        textAlign: 'center'
      }}
    >
      {icon}
      <Typography variant="h5" component="p">
        {title}
      </Typography>
      <Typography variant="body2" color="textSecondary" sx={{ maxWidth: 360 }}>
        {text}
      </Typography>
      <Box sx={{ mt: 1 }}>{action}</Box>
    </Box>
  )
}

const accessColumns = (count: number) => {
  const columns = (width: number) =>
    `minmax(0, 1fr) repeat(${String(count)}, ${String(width)}px)`
  return { xs: columns(52), sm: columns(72) }
}

// A permissions table: one resource per row, one radio column per access level.
export function AccessTable({
  labelledBy,
  levels,
  children
}: {
  labelledBy: string
  levels: string[]
  children: ReactNode
}): ReactElement {
  return (
    <Box
      role="group"
      aria-labelledby={labelledBy}
      sx={{
        border: 1,
        borderColor: 'divider',
        borderRadius: '12px',
        overflow: 'hidden',
        '& > * + *': { borderTop: 1, borderColor: 'divider' }
      }}
    >
      <Box
        aria-hidden
        sx={{
          display: 'grid',
          gridTemplateColumns: accessColumns(levels.length),
          px: 1.5,
          py: 0.75,
          bgcolor: 'action.hover'
        }}
      >
        <span />
        {levels.map(level => (
          <Typography
            key={level}
            variant="caption"
            color="textSecondary"
            sx={{ textAlign: 'center', fontWeight: 600 }}
          >
            {level}
          </Typography>
        ))}
      </Box>
      {children}
    </Box>
  )
}

interface AccessOption {
  value: string
  label: string
  available: boolean
}

export function AccessRow({
  id,
  title,
  text,
  options,
  value,
  onChange,
  unavailableLabel
}: {
  id: string
  title: string
  text: string
  options: AccessOption[]
  value: string
  onChange: (value: string) => void
  unavailableLabel: string
}): ReactElement {
  return (
    <RadioGroup
      aria-labelledby={id}
      name={id}
      value={value}
      onChange={(_event, picked) => {
        onChange(picked)
      }}
      sx={{
        display: 'grid',
        gridTemplateColumns: accessColumns(options.length),
        alignItems: 'center',
        px: 1.5,
        py: 1
      }}
    >
      <Box sx={{ minWidth: 0, pr: 1 }}>
        <Typography
          id={id}
          variant="body2"
          component="p"
          sx={{ fontWeight: 600 }}
        >
          {title}
        </Typography>
        <Typography variant="caption" color="textSecondary" component="p">
          {text}
        </Typography>
      </Box>
      {options.map(option => (
        <Box
          key={option.value}
          sx={{ display: 'flex', justifyContent: 'center' }}
        >
          {option.available ? (
            <Radio
              size="small"
              value={option.value}
              slotProps={{ input: { 'aria-label': option.label } }}
            />
          ) : (
            <Typography
              aria-hidden
              title={unavailableLabel}
              color="textDisabled"
            >
              –
            </Typography>
          )}
        </Box>
      ))}
    </RadioGroup>
  )
}

// A radio drawn as a card, for a choice between a few options.
export function ChoiceCard({
  title,
  text,
  checked,
  onSelect,
  children
}: {
  title: string
  text?: ReactNode
  checked: boolean
  onSelect: () => void
  children?: ReactNode
}): ReactElement {
  return (
    <Box
      sx={{
        borderRadius: '12px',
        border: 1,
        borderColor: checked ? 'primary.main' : 'divider',
        bgcolor: checked ? 'action.selected' : 'transparent',
        transition: 'border-color 120ms, background-color 120ms',
        '&:hover': { borderColor: 'primary.main' }
      }}
    >
      <Box
        component="label"
        sx={{
          display: 'flex',
          gap: 1,
          alignItems: 'flex-start',
          p: 1.25,
          cursor: 'pointer'
        }}
      >
        <Radio
          size="small"
          checked={checked}
          onChange={onSelect}
          sx={{ p: 0.25 }}
        />
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" component="span" sx={{ fontWeight: 600 }}>
            {title}
          </Typography>
          {text && (
            <Typography
              variant="caption"
              color="textSecondary"
              component="span"
              sx={{ display: 'block' }}
            >
              {text}
            </Typography>
          )}
        </Box>
      </Box>
      {children && <Box sx={{ px: 1.25, pb: 1.25 }}>{children}</Box>}
    </Box>
  )
}

// Two columns on wide dialogs so a long form fits without scrolling.
export function FormColumns({
  start,
  end
}: {
  start: ReactNode
  end: ReactNode
}): ReactElement {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: {
          xs: '1fr',
          md: 'minmax(0, 1.2fr) minmax(0, 1fr)'
        },
        gap: 3,
        alignItems: 'start'
      }}
    >
      <Stack spacing={2.5}>{start}</Stack>
      <Stack spacing={2.5}>{end}</Stack>
    </Box>
  )
}

export function FieldGroup({
  id,
  label,
  hint,
  children
}: {
  id: string
  label: string
  hint?: ReactNode
  children: ReactNode
}): ReactElement {
  return (
    <Stack spacing={1}>
      <Typography id={id} variant="subtitle2" component="h3">
        {label}
      </Typography>
      {children}
      {hint && (
        <Typography variant="caption" color="textSecondary" component="p">
          {hint}
        </Typography>
      )}
    </Stack>
  )
}
