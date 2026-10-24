import 'dayjs/locale/de'
import 'dayjs/locale/es'
import 'dayjs/locale/fr'
import 'dayjs/locale/it'
import 'dayjs/locale/ru'
import 'dayjs/locale/vi'

import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { usePickerAdapter } from '@mui/x-date-pickers/hooks'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { TimePicker } from '@mui/x-date-pickers/TimePicker'
import { renderDigitalClockTimeView } from '@mui/x-date-pickers/timeViewRenderers'
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
import {
  useState,
  type ComponentProps,
  type KeyboardEvent,
  type MouseEvent,
  type ReactElement,
  type ReactNode
} from 'react'

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

// Twake Calendar's day formats
const LONG_DAY = 'dddd, MMMM D, YYYY'
const LONG_DAYS: Record<string, string> = {
  fr: 'dddd D MMMM YYYY',
  es: 'dddd, D [de] MMMM [de] YYYY',
  de: 'dddd, D. MMMM YYYY',
  it: 'dddd D MMMM YYYY',
  ru: 'dddd, D MMMM YYYY',
  vi: 'dddd, D MMMM, YYYY'
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

// The field opens the popup itself, the pickers hide their button
function usePopup() {
  const [open, setOpen] = useState(false)
  return {
    open,
    onOpen: () => {
      setOpen(true)
    },
    onClose: () => {
      setOpen(false)
    },
    trigger: {
      // Clicks in the popup reach the field too, through the React portal
      onClick: (event: MouseEvent<HTMLElement>) => {
        if (event.currentTarget.contains(event.target as Node)) setOpen(true)
      },
      // Escape closes the popup, not the dialog around the field
      onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
        if (open && event.key === 'Escape') {
          event.stopPropagation()
          setOpen(false)
        }
      }
    }
  }
}

const textField = {
  fullWidth: true,
  size: 'small',
  margin: 'dense',
  slotProps: { inputLabel: { shrink: true } }
} as const

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
  const lang = usePickerAdapter().getCurrentLocaleCode()
  const { trigger, ...popup } = usePopup()
  return (
    <DatePicker
      {...popup}
      label={label}
      format={LONG_DAYS[lang] ?? LONG_DAY}
      value={value ? dayjs(value) : null}
      onChange={(next: Dayjs | null) => {
        onChange(next?.isValid() ? next.format(DAY) : '')
      }}
      slotProps={{
        field: { readOnly: true },
        // The long day takes two thirds of a row shared with a time
        textField: { ...textField, ...trigger, sx: { flex: '2 1 0' } },
        openPickerButton: { sx: { display: 'none' } },
        layout: {
          sx: {
            '& .MuiDateCalendar-root.MuiDateCalendar-root': {
              width: 260,
              maxWidth: 260,
              px: '15px'
            }
          }
        }
      }}
    />
  )
}

/** Times are HH:mm strings, empty for none, picked in steps of 30 minutes. */
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
  const { trigger, ...popup } = usePopup()
  return (
    <TimePicker
      {...popup}
      closeOnSelect
      label={label}
      value={value ? dayjs(`2000-01-01T${value}`) : null}
      ampm={false}
      timeSteps={{ minutes: 30 }}
      // One column of the 48 half hours of a day
      thresholdToRenderTimeInASingleColumn={48}
      // The list leaves the focus in the field, to type a time while it is open
      viewRenderers={{
        hours: props =>
          renderDigitalClockTimeView({
            ...props,
            autoFocus: false,
            focusedView: null
          })
      }}
      onChange={(next: Dayjs | null) => {
        onChange(next?.isValid() ? next.format(TIME) : '')
      }}
      slots={{ actionBar: () => null }}
      slotProps={{
        textField: {
          ...textField,
          helperText,
          ...trigger,
          sx: { flex: '1 1 0' }
        },
        openPickerButton: { sx: { display: 'none' } },
        popper: {
          sx: {
            '& .MuiPaper-root': { width: 110, minWidth: 110 },
            '& .MuiMultiSectionDigitalClockSection-item': {
              justifyContent: 'flex-start',
              width: '100%',
              textAlign: 'left'
            }
          }
        }
      }}
    />
  )
}
