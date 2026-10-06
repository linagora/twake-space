import { CalendarApp, Chat, Drive, Icon, Mail } from '@linagora/twake-icons'
import {
  Alert,
  Avatar,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  Divider,
  FormControlLabel,
  Grid,
  Stack,
  TextField,
  Typography,
  getInitials
} from '@linagora/twake-mui'
import { useId, useState, type ReactElement, type ReactNode } from 'react'

import type { SpaceApp } from '@/application/spaces'
import addReaction from '@/assets/add-reaction.svg'
import feedTile from '@/assets/feed.svg'
import tasksTile from '@/assets/tasks.svg'
import { AvatarPicker, ColorSwatches } from '@/ds/AvatarPicker'
import { DialogHeader } from '@/ds/Dialog'
import { useI18n } from '@/ui/i18n/useI18n'
import { useCreateSpace } from '@/ui/spaces/queries'

type Step = 'details' | 'personalize' | 'apps'

const tile = (src: string): ReactElement => (
  <img src={src} alt="" width={24} height={24} />
)

const APP_ICONS: Record<SpaceApp, ReactElement> = {
  feed: tile(feedTile),
  drive: <Icon icon={Drive} size={24} />,
  chat: <Icon icon={Chat} size={24} />,
  tasks: tile(tasksTile),
  calendar: <Icon icon={CalendarApp} size={24} />,
  mail: <Icon icon={Mail} size={24} />
}

// The first column is on by default, the second one off.
const DEFAULT_APPS: SpaceApp[] = ['feed', 'drive', 'chat', 'tasks']
const OTHER_APPS: SpaceApp[] = ['calendar', 'mail']

const COLORS = [
  '#696c6f',
  '#d3bfa4',
  '#e1e3e6',
  '#ff4d5e',
  '#ff7750',
  '#f5ac00',
  '#ffd54c',
  '#ffe082',
  '#006bd8',
  '#46a2ff',
  '#91cef6',
  '#afffeb',
  '#2dd4ab',
  '#66e49a',
  '#6ad049',
  '#00bf62',
  '#713fa5',
  '#a777e8',
  '#ad95ff',
  '#bfa9ff',
  '#fba0b8',
  '#e694e0',
  '#e375cd',
  '#dbcac9'
]

function DraftAvatar({
  name,
  color,
  size
}: {
  name: string
  color: string | null
  size: number
}): ReactElement {
  if (color) {
    return (
      <Avatar size={size} color={color}>
        {getInitials(name, '')}
      </Avatar>
    )
  }
  return (
    <Avatar size={size} color="var(--twake-palette-background-default)">
      <img src={addReaction} alt="" width={24} height={24} />
    </Avatar>
  )
}

function AppCheckbox({
  icon,
  label,
  checked,
  onChange
}: {
  icon: ReactNode
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}): ReactElement {
  return (
    <FormControlLabel
      control={
        <Checkbox
          checked={checked}
          onChange={(_event, value) => {
            onChange(value)
          }}
        />
      }
      label={
        <span className="u-flex u-flex-items-center u-ml-half">
          {icon}
          <span className="u-ml-half">{label}</span>
        </span>
      }
      slotProps={{ typography: { variant: 'body2' } }}
    />
  )
}

export function CreateSpaceDialog({
  onClose
}: {
  onClose: () => void
}): ReactElement {
  const { t } = useI18n()
  const titleId = useId()
  const nameId = useId()
  const appsHintId = useId()
  const create = useCreateSpace()
  const [step, setStep] = useState<Step>('details')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState<string | null>(null)
  const [apps, setApps] = useState<ReadonlySet<SpaceApp>>(
    () => new Set(DEFAULT_APPS)
  )
  const trimmed = name.trim()

  const toggle = (key: SpaceApp) => (checked: boolean) => {
    setApps(previous => {
      const next = new Set(previous)
      if (checked) next.add(key)
      else next.delete(key)
      return next
    })
  }

  const header = (title: string, back?: Step): ReactElement => (
    <DialogHeader
      id={titleId}
      title={title}
      close={{ label: t('common.close'), onClick: onClose }}
      back={
        back && {
          label: t('common.back'),
          onClick: () => {
            setStep(back)
          }
        }
      }
    />
  )

  const appCheckbox = (app: SpaceApp): ReactElement => (
    <AppCheckbox
      key={app}
      icon={APP_ICONS[app]}
      label={t(`createSpace.app.${app}`)}
      checked={apps.has(app)}
      onChange={toggle(app)}
    />
  )

  return (
    <Dialog
      open
      onClose={onClose}
      aria-labelledby={titleId}
      size={step === 'personalize' ? 'small' : 'medium'}
    >
      {step === 'details' && (
        <form
          onSubmit={event => {
            event.preventDefault()
            setStep('apps')
          }}
        >
          {header(t('spaces.create'))}
          <DialogContent className="u-pb-1-half">
            <Stack spacing={4}>
              <Stack
                direction="row"
                spacing={2.5}
                className="u-flex-items-center"
              >
                <AvatarPicker
                  avatar={<DraftAvatar name={name} color={color} size={96} />}
                  pickLabel={t('createSpace.personalize')}
                  onPick={() => {
                    setStep('personalize')
                  }}
                />
                <Stack spacing={1} className="u-flex-grow-1">
                  <Typography
                    component="label"
                    htmlFor={nameId}
                    variant="body2"
                  >
                    {t('createSpace.name')}
                  </Typography>
                  <TextField
                    id={nameId}
                    fullWidth
                    size="small"
                    value={name}
                    onChange={event => {
                      setName(event.target.value)
                    }}
                    slotProps={{ htmlInput: { maxLength: 255 } }}
                  />
                </Stack>
              </Stack>
              <TextField
                fullWidth
                size="small"
                multiline
                minRows={3}
                label={t('createSpace.description')}
                value={description}
                onChange={event => {
                  setDescription(event.target.value)
                }}
                slotProps={{ htmlInput: { maxLength: 1000 } }}
              />
            </Stack>
          </DialogContent>
          <Divider />
          <DialogActions>
            <Button variant="text" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" variant="contained" disabled={trimmed === ''}>
              {t('common.next')}
            </Button>
          </DialogActions>
        </form>
      )}
      {step === 'personalize' && (
        <PersonalizeStep
          header={header(t('createSpace.personalize'), 'details')}
          name={name}
          color={color}
          onCancel={() => {
            setStep('details')
          }}
          onApply={picked => {
            setColor(picked)
            setStep('details')
          }}
        />
      )}
      {step === 'apps' && (
        <form
          onSubmit={event => {
            event.preventDefault()
            create.mutate(
              {
                name: trimmed,
                description: description.trim(),
                color,
                apps: [...apps]
              },
              { onSuccess: onClose }
            )
          }}
        >
          {header(t('createSpace.apps'), 'details')}
          <DialogContent className="u-pb-1-half">
            <Typography id={appsHintId} className="u-mb-1-half">
              {t('createSpace.appsHint')}
            </Typography>
            <Grid
              container
              columnSpacing={3}
              role="group"
              aria-labelledby={appsHintId}
            >
              <Grid size={{ xs: 12, sm: 6 }}>
                <Stack spacing={1}>{DEFAULT_APPS.map(appCheckbox)}</Stack>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Stack spacing={1}>{OTHER_APPS.map(appCheckbox)}</Stack>
              </Grid>
            </Grid>
            {create.isError && (
              <Alert severity="error" className="u-mt-1">
                {t('spaces.createFailed')}
              </Alert>
            )}
          </DialogContent>
          <Divider />
          <DialogActions>
            <Button
              variant="text"
              onClick={() => {
                setStep('details')
              }}
            >
              {t('common.back')}
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={create.isPending}
            >
              {t('common.create')}
            </Button>
          </DialogActions>
        </form>
      )}
    </Dialog>
  )
}

function PersonalizeStep({
  header,
  name,
  color,
  onCancel,
  onApply
}: {
  header: ReactNode
  name: string
  color: string | null
  onCancel: () => void
  onApply: (color: string) => void
}): ReactElement {
  const { t } = useI18n()
  const [picked, setPicked] = useState(color)

  return (
    <>
      {header}
      <DialogContent className="u-pb-1-half">
        <Stack spacing={3} className="u-flex-items-center">
          <DraftAvatar name={name} color={picked} size={48} />
          <Typography>{t('createSpace.colorHint')}</Typography>
          <ColorSwatches
            label={t('createSpace.colors')}
            colors={COLORS}
            value={picked}
            onChange={setPicked}
          />
        </Stack>
      </DialogContent>
      <Divider />
      <DialogActions>
        <Button variant="outlined" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button
          variant="contained"
          disabled={picked === null}
          onClick={() => {
            if (picked) onApply(picked)
          }}
        >
          {t('common.apply')}
        </Button>
      </DialogActions>
    </>
  )
}
