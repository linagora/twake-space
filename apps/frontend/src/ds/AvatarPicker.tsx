import { Check, Icon, Pen } from '@linagora/twake-icons'
import {
  Box,
  IconButton,
  Radio,
  RadioGroup,
  radioClasses
} from '@linagora/twake-mui'
import { useRef, type ReactElement, type ReactNode } from 'react'

// The avatar opens a picker; the pen badge uploads a photo instead.
export function AvatarPicker({
  avatar,
  pickLabel,
  uploadLabel,
  onPick,
  onUpload
}: {
  avatar: ReactNode
  pickLabel: string
  uploadLabel: string
  onPick: () => void
  onUpload: (file: File) => void
}): ReactElement {
  const input = useRef<HTMLInputElement>(null)

  return (
    <Box sx={{ position: 'relative', flex: 'none' }}>
      <IconButton aria-label={pickLabel} onClick={onPick} sx={{ p: 0 }}>
        {avatar}
      </IconButton>
      <IconButton
        aria-label={uploadLabel}
        onClick={() => input.current?.click()}
        sx={{
          position: 'absolute',
          right: -1,
          bottom: -1,
          width: 38,
          height: 38,
          p: 0,
          border: 4,
          borderColor: 'background.paper',
          bgcolor: 'primary.main',
          color: 'primary.contrastText',
          '&:hover': { bgcolor: 'primary.dark' }
        }}
      >
        <Icon icon={Pen} size={15} />
      </IconButton>
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={event => {
          const file = event.target.files?.[0]
          if (file) onUpload(file)
          event.target.value = ''
        }}
      />
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
