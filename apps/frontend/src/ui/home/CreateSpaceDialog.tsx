import { Icon, Palette } from '@linagora/twake-icons'
import {
  Alert,
  Avatar,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  Divider,
  Stack,
  TextField,
  Typography,
  getInitials
} from '@linagora/twake-mui'
import { useId, useState, type ReactElement, type ReactNode } from 'react'

import type { SpaceApp } from '@/application/spaces'
import { AvatarPicker, ColorSwatches } from '@/ds/AvatarPicker'
import { DialogHeader } from '@/ds/Dialog'
import { useI18n } from '@/ui/i18n/useI18n'
import { AppPicker, DEFAULT_APPS } from '@/ui/spaces/AppPicker'
import { useCreateSpace, useSpaceApps } from '@/ui/spaces/queries'

type Step = 'details' | 'personalize' | 'apps'

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
      <Icon icon={Palette} size={24} color="#424244" />
    </Avatar>
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
  const offered = useSpaceApps()
  const provided = offered.data ?? []
  const [step, setStep] = useState<Step>('details')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState<string | null>(null)
  const [apps, setApps] = useState<ReadonlySet<SpaceApp>>(
    () => new Set(DEFAULT_APPS)
  )
  const trimmed = name.trim()

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
                apps: [...apps].filter(app => provided.includes(app))
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
            <AppPicker
              provided={provided}
              picked={apps}
              onChange={setApps}
              labelledBy={appsHintId}
            />
            {offered.isError && (
              <Alert severity="error" className="u-mt-1">
                {t('createSpace.appsFailed')}
              </Alert>
            )}
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
              disabled={create.isPending || !offered.isSuccess}
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
