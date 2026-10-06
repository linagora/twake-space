import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  FormControlLabel,
  Stack,
  TextField,
  Typography
} from '@linagora/twake-mui'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useId, useState, type ReactElement } from 'react'

import { isRefusal, type Space, type SpaceRole } from '@/application/spaces'
import { DialogHeader } from '@/ds/Dialog'
import { useI18n } from '@/ui/i18n/useI18n'
import { useServices } from '@/ui/services/Services'
import { RoleSelect } from '@/ui/space/RoleSelect'
import { useSpaceWrite } from '@/ui/spaces/queries'

interface Candidate {
  id: string
  label: string
}

export function AddToSpaceDialog({
  kind,
  space,
  onClose
}: {
  kind: 'people' | 'groups'
  space: Space
  onClose: () => void
}): ReactElement {
  const { t } = useI18n()
  const { directory } = useServices()
  const write = useSpaceWrite(space.id)
  const titleId = useId()
  const [search, setSearch] = useState('')
  const [picked, setPicked] = useState<string[]>([])
  const [role, setRole] = useState<SpaceRole>('viewer')
  // The directory searches from two characters; one would list everyone.
  const query = search.trim().length >= 2 ? search.trim() : ''
  const present = new Set(
    kind === 'people'
      ? space.members.map(m => m.username)
      : space.groups.map(g => g.id)
  )

  const found = useInfiniteQuery({
    queryKey: ['directory', kind, query],
    initialPageParam: 1,
    queryFn: async ({
      pageParam
    }): Promise<{
      candidates: Candidate[]
      hasNextPage: boolean
    }> => {
      if (kind === 'people') {
        const page = await directory.people(query, pageParam)
        return {
          candidates: page.people.map(p => ({
            id: p.username,
            label: p.displayName || p.username
          })),
          hasNextPage: page.hasNextPage
        }
      }
      const page = await directory.groups(query, pageParam)
      return {
        candidates: page.groups.map(g => ({ id: g.id, label: g.name })),
        hasNextPage: page.hasNextPage
      }
    },
    getNextPageParam: (last, pages) =>
      last.hasNextPage ? pages.length + 1 : undefined
  })
  const candidates = (found.data?.pages ?? [])
    .flatMap(page => page.candidates)
    .filter(c => !present.has(c.id))

  const title = t(
    kind === 'people' ? 'members.addPeople' : 'members.linkGroups'
  )
  const submit = () => {
    write.mutate(
      spaces =>
        kind === 'people'
          ? spaces.addMembers(space.id, picked, role)
          : spaces.linkGroups(space.id, picked, role),
      { onSuccess: onClose }
    )
  }

  return (
    <Dialog open onClose={onClose} aria-labelledby={titleId} size="medium">
      <DialogHeader
        id={titleId}
        title={title}
        close={{ label: t('common.close'), onClick: onClose }}
      />
      <DialogContent>
        <Stack spacing={2}>
          {write.error && (
            <Alert severity="error">
              {isRefusal(write.error) && write.error.code
                ? t('members.refused', { code: write.error.code })
                : t('members.failed')}
            </Alert>
          )}
          <TextField
            label={t('members.search')}
            value={search}
            onChange={event => {
              setSearch(event.target.value)
            }}
          />
          {found.isError && (
            <Alert severity="error">{t('members.searchFailed')}</Alert>
          )}
          {found.isSuccess && !found.hasNextPage && candidates.length === 0 && (
            <Typography color="textSecondary">
              {t(
                kind === 'people'
                  ? 'members.noOneMatches'
                  : 'members.noGroupMatches'
              )}
            </Typography>
          )}
          <Stack>
            {candidates.map(c => (
              <FormControlLabel
                key={c.id}
                label={c.label}
                control={
                  <Checkbox
                    checked={picked.includes(c.id)}
                    onChange={(_event, checked) => {
                      setPicked(ids =>
                        checked ? [...ids, c.id] : ids.filter(id => id !== c.id)
                      )
                    }}
                  />
                }
              />
            ))}
          </Stack>
          {found.hasNextPage && (
            <Button
              variant="text"
              disabled={found.isFetchingNextPage}
              onClick={() => {
                void found.fetchNextPage()
              }}
            >
              {t('members.more')}
            </Button>
          )}
          <RoleSelect
            label={t('members.role')}
            value={role}
            onChange={setRole}
            hiddenLabel={false}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="text" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button
          variant="contained"
          disabled={picked.length === 0 || write.isPending}
          onClick={submit}
        >
          {t('common.add')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
