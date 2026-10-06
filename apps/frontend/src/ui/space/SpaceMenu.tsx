import {
  Dots,
  Icon,
  Link,
  People,
  Pen,
  PersonAdd,
  Trash
} from '@linagora/twake-icons'
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  Divider,
  IconButton,
  Menu,
  Snackbar,
  Stack,
  TextField,
  Typography
} from '@linagora/twake-mui'
import { useEffect, useId, useState, type ReactElement } from 'react'
import { useNavigate } from 'react-router'

import type { SpaceSummary } from '@/application/spaces'
import { DialogHeader } from '@/ds/Dialog'
import { MenuEntry } from '@/ds/Menu'
import { useI18n } from '@/ui/i18n/useI18n'
import { AddToSpaceDialog } from '@/ui/space/AddToSpaceDialog'
import { WriteError } from '@/ui/space/WriteError'
import { useDeleteSpace, useRenameSpace, useSpace } from '@/ui/spaces/queries'

type Named = Pick<SpaceSummary, 'id' | 'name'>

const spaceUrl = (id: string): string =>
  `${window.location.origin}/spaces/${encodeURIComponent(id)}`

// Copies the space's link and says so for a moment.
export function useShareLink(id: string): {
  share: () => void
  notice: ReactElement
} {
  const { t } = useI18n()
  const [copied, setCopied] = useState(false)
  return {
    share: () => {
      void navigator.clipboard.writeText(spaceUrl(id)).then(() => {
        setCopied(true)
      })
    },
    notice: (
      <Snackbar
        open={copied}
        autoHideDuration={3000}
        onClose={() => {
          setCopied(false)
        }}
        message={t('spaceMenu.linkCopied')}
      />
    )
  }
}

export function ShareLinkButton({ id }: { id: string }): ReactElement {
  const { t } = useI18n()
  const { share, notice } = useShareLink(id)
  return (
    <>
      <IconButton aria-label={t('spaceMenu.shareLink')} onClick={share}>
        <Icon icon={Link} />
      </IconButton>
      {notice}
    </>
  )
}

// The "more" menu of a space, on its card and in its header. Every entry
// does something today: the mockup's pin, notification and archive wait for
// their backend.
export function SpaceMenu({
  space
}: {
  space: Pick<SpaceSummary, 'id' | 'name' | 'role'>
}): ReactElement {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const [dialog, setDialog] = useState<'invite' | 'edit' | 'delete' | null>(
    null
  )
  const { share, notice } = useShareLink(space.id)
  const isAdmin = space.role === 'admin'
  const close = (): void => {
    setAnchor(null)
  }
  const open = (which: 'invite' | 'edit' | 'delete') => () => {
    close()
    setDialog(which)
  }
  const closeDialog = (): void => {
    setDialog(null)
  }
  const item = (
    key: string,
    icon: typeof Dots,
    label: string,
    onClick: () => void,
    danger = false
  ) => (
    <MenuEntry
      key={key}
      icon={<Icon icon={icon} />}
      onClick={onClick}
      danger={danger}
    >
      {label}
    </MenuEntry>
  )

  return (
    <>
      <IconButton
        aria-label={t('spaceMenu.open', { name: space.name })}
        aria-haspopup="menu"
        aria-expanded={anchor !== null}
        onClick={event => {
          setAnchor(event.currentTarget)
        }}
      >
        <Icon icon={Dots} />
      </IconButton>
      <Menu anchorEl={anchor} open={anchor !== null} onClose={close}>
        {item('share', Link, t('spaceMenu.shareLink'), () => {
          close()
          share()
        })}
        {isAdmin &&
          item('invite', PersonAdd, t('spaceMenu.invite'), open('invite'))}
        <Divider />
        {item(
          'people',
          People,
          t(isAdmin ? 'spaceMenu.managePeople' : 'spaceMenu.members'),
          () => {
            close()
            void navigate(`/spaces/${space.id}/members`)
          }
        )}
        {isAdmin && item('edit', Pen, t('spaceActions.edit'), open('edit'))}
        {isAdmin && <Divider />}
        {isAdmin &&
          item('delete', Trash, t('spaceActions.delete'), open('delete'), true)}
      </Menu>
      {notice}
      {dialog === 'invite' && (
        <InviteDialog spaceId={space.id} onClose={closeDialog} />
      )}
      {dialog === 'edit' && <EditDialog space={space} onClose={closeDialog} />}
      {dialog === 'delete' && (
        <DeleteDialog space={space} onClose={closeDialog} />
      )}
    </>
  )
}

// The people picker needs who is already in: read the space first.
function InviteDialog({
  spaceId,
  onClose
}: {
  spaceId: string
  onClose: () => void
}): ReactElement | null {
  const space = useSpace(spaceId)
  useEffect(() => {
    if (space.isError) onClose()
  }, [space.isError, onClose])
  if (!space.data) return null
  return <AddToSpaceDialog kind="people" space={space.data} onClose={onClose} />
}

export function EditDialog({
  space,
  onClose
}: {
  space: Named
  onClose: () => void
}): ReactElement {
  const { t } = useI18n()
  const titleId = useId()
  const rename = useRenameSpace(space.id)
  const [name, setName] = useState(space.name)
  const trimmed = name.trim()
  return (
    <Dialog open onClose={onClose} aria-labelledby={titleId} size="small">
      <form
        onSubmit={event => {
          event.preventDefault()
          rename.mutate(trimmed, { onSuccess: onClose })
        }}
      >
        <DialogHeader
          id={titleId}
          title={t('spaceActions.edit')}
          close={{ label: t('common.close'), onClick: onClose }}
        />
        <DialogContent>
          <Stack spacing={2}>
            <WriteError error={rename.error} />
            <TextField
              label={t('createSpace.name')}
              value={name}
              onChange={event => {
                setName(event.target.value)
              }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button variant="text" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={trimmed === '' || rename.isPending}
          >
            {t('common.save')}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}

export function DeleteDialog({
  space,
  onClose
}: {
  space: Named
  onClose: () => void
}): ReactElement {
  const { t } = useI18n()
  const titleId = useId()
  const navigate = useNavigate()
  const remove = useDeleteSpace(space.id)
  return (
    <Dialog open onClose={onClose} aria-labelledby={titleId} size="small">
      <DialogHeader
        id={titleId}
        title={t('spaceActions.deleteTitle', { name: space.name })}
        close={{ label: t('common.close'), onClick: onClose }}
      />
      <DialogContent>
        <Stack spacing={2}>
          <WriteError error={remove.error} />
          <Typography>{t('spaceActions.deleteHint')}</Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="text" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button
          variant="contained"
          color="error"
          disabled={remove.isPending}
          onClick={() => {
            remove.mutate(undefined, {
              onSuccess: () => {
                void navigate('/', { replace: true })
              }
            })
          }}
        >
          {t('common.delete')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
