import { Check, Icon, Pen } from '@linagora/twake-icons'
import {
  Box,
  IconButton,
  Radio,
  RadioGroup,
  radioClasses
} from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'

// The pen badge tells the avatar opens a picker.
export function AvatarPicker({
  avatar,
  pickLabel,
  onPick
}: {
  avatar: ReactNode
  pickLabel: string
  onPick: () => void
}): ReactElement {
  return (
    <Box sx={{ position: 'relative', flex: 'none' }}>
      <IconButton aria-label={pickLabel} onClick={onPick} sx={{ p: 0 }}>
        {avatar}
        <Box
          component="span"
          sx={{
            position: 'absolute',
            right: -1,
            bottom: -1,
            width: 38,
            height: 38,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '50%',
            border: 4,
            borderColor: 'background.paper',
            bgcolor: 'primary.main',
            color: 'primary.contrastText'
          }}
        >
          <Icon icon={Pen} size={15} />
        </Box>
      </IconButton>
    </Box>
  )
}

function Swatch({
  color,
  checked
}: {
  color: string
  checked?: boolean
}): ReactElement {
  return (
    <Box
      component="span"
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 25,
        height: 25,
        borderRadius: '50%',
        bgcolor: color
      }}
    >
      {checked && <Icon icon={Check} size={12} />}
    </Box>
  )
}

export function ColorSwatches({
  label,
  colors,
  value,
  onChange
}: {
  label: string
  colors: readonly string[]
  value: string | null
  onChange: (color: string) => void
}): ReactElement {
  return (
    <RadioGroup
      aria-label={label}
      value={value ?? ''}
      onChange={(_event, color) => {
        onChange(color)
      }}
      sx={{
        display: 'grid',
        gridTemplateColumns: 'repeat(8, 25px)',
        gap: '15px 8px',
        justifyContent: 'center'
      }}
    >
      {colors.map(color => (
        <Radio
          key={color}
          value={color}
          icon={<Swatch color={color} />}
          checkedIcon={<Swatch color={color} checked />}
          slotProps={{ input: { 'aria-label': color } }}
          // The theme paints radio icons; the check stays white on any swatch.
          sx={{
            p: 0,
            '& svg': { fill: '#fff' },
            [`&.${radioClasses.checked} svg`]: { fill: '#fff' }
          }}
        />
      ))}
    </RadioGroup>
  )
}
