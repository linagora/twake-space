import 'dayjs/locale/de'
import 'dayjs/locale/es'
import 'dayjs/locale/fr'
import 'dayjs/locale/it'
import 'dayjs/locale/ru'
import 'dayjs/locale/vi'

import { Calendar, ClockOutline, Icon } from '@linagora/twake-icons'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { TimePicker } from '@mui/x-date-pickers/TimePicker'
import {
  deDE,
  enUS,
  esES,
  frFR,
  itIT,
  ruRU,
  viVN
} from '@mui/x-date-pickers/locales'
import dayjs, { type Dayjs } from 'dayjs'
import type { ComponentProps, ReactElement, ReactNode } from 'react'

type LocaleText = NonNullable<
  ComponentProps<typeof LocalizationProvider>['localeText']
>

const TEXTS: Record<string, typeof enUS> = {
  en: enUS,
  fr: frFR,
  de: deDE,
  es: esES,
  it: itIT,
  ru: ruRU,
  vi: viVN
}

const DAY = 'YYYY-MM-DD'
const TIME = 'HH:mm'

export function PickersProvider({
  lang,
  children
}: {
  lang: string
  children: ReactNode
}): ReactElement {
  return (
    <LocalizationProvider
      dateAdapter={AdapterDayjs}
      adapterLocale={lang}
      // The locale packs type each text as `string | undefined`, which
      // exactOptionalPropertyTypes refuses for an optional key
      localeText={
        (TEXTS[lang] ?? enUS).components.MuiLocalizationProvider.defaultProps
          .localeText as LocaleText
      }
    >
      {children}
    </LocalizationProvider>
  )
}

// The theme gives icon buttons the secondary text colour, not the icon one
const openPickerButton = { sx: { color: 'text.icon' } }
const CalendarIcon = () => <Icon icon={Calendar} />
const ClockIcon = () => <Icon icon={ClockOutline} />

/** Days are YYYY-MM-DD strings, empty for none. */
export function DayField({
  label,
  value,
  onChange
}: {
  label: string
  value: string
  onChange: (day: string) => void
}): ReactElement {
  return (
    <DatePicker
      label={label}
      value={value ? dayjs(value) : null}
      onChange={(next: Dayjs | null) => {
        onChange(next?.isValid() ? next.format(DAY) : '')
      }}
      slots={{ openPickerIcon: CalendarIcon }}
      slotProps={{ textField: { fullWidth: true }, openPickerButton }}
    />
  )
}

/** Times are HH:mm strings, empty for none. */
export function TimeField({
  label,
  value,
  helperText,
  onChange
}: {
  label: string
  value: string
  helperText: string
  onChange: (time: string) => void
}): ReactElement {
  return (
    <TimePicker
      label={label}
      value={value ? dayjs(`2000-01-01T${value}`) : null}
      ampm={false}
      onChange={(next: Dayjs | null) => {
        onChange(next?.isValid() ? next.format(TIME) : '')
      }}
      slots={{ openPickerIcon: ClockIcon }}
      slotProps={{
        textField: { fullWidth: true, helperText },
        openPickerButton
      }}
    />
  )
}
