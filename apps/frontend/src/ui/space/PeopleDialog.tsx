import { Icon, Trash, Unlink } from '@linagora/twake-icons'
import {
  Alert,
  Autocomplete,
  Button,
  Chip,
  Dialog,
  DialogContent,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Stack,
  TextField,
  Typography
} from '@linagora/twake-mui'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useId, useState, type ReactElement } from 'react'

import type { Space, SpaceRole, SpacesService } from '@/application/spaces'
import { DialogHeader } from '@/ds/Dialog'
import { useI18n } from '@/ui/i18n/useI18n'
import { useServices } from '@/ui/services/Services'
import { RoleSelect } from '@/ui/space/RoleSelect'
import { WriteError } from '@/ui/space/WriteError'
import { useSpaceWrite } from '@/ui/spaces/queries'

interface Candidate {
  kind: 'people' | 'groups'
  id: string
  label: string
  detail?: string
}

interface Row {
  id: string
  primary: string
  secondary?: string
  role: SpaceRole
}

export function PeopleDialog({
  space,
  onClose
}: {
  space: Space
  onClose: () => void
}): ReactElement {
  const { t } = useI18n()
  const titleId = useId()
  const write = useSpaceWrite(space.id)
  const isAdmin = space.role === 'admin'
  const run = (change: (spaces: SpacesService) => Promise<void>) => {
    write.mutate(change)
  }

  return (
    <Dialog open onClose={onClose} aria-labelledby={titleId} size="medium">
      <DialogHeader
        id={titleId}
        title={t(isAdmin ? 'spaceMenu.managePeople' : 'spaceMenu.members')}
        close={{ label: t('common.close'), onClick: onClose }}
      />
      <DialogContent>
        <Stack spacing={2}>
          <WriteError error={write.error} />
          {isAdmin && <AddRow space={space} write={write} />}
          <Section
            title={t('members.members')}
            empty={t('members.noMembers')}
            rows={space.members.map(m => ({
              id: m.id,
              primary: m.displayName ?? m.username,
              secondary: m.email,
              role: m.role
            }))}
            admin={
              isAdmin && {
                remove: name => t('members.remove', { name }),
                removeIcon: Trash,
                onRemove: id => {
                  run(s => s.removeMember(space.id, id))
                },
                onRole: (id, role) => {
                  run(s => s.setMemberRole(space.id, id, role))
                }
              }
            }
          />
          <Section
            title={t('members.groups')}
            empty={t('members.noGroups')}
            rows={space.groups.map(g => ({
              id: g.id,
              primary: g.name,
              role: g.role
            }))}
            admin={
              isAdmin && {
                remove: name => t('members.unlink', { name }),
                removeIcon: Unlink,
                onRemove: id => {
                  run(s => s.unlinkGroup(space.id, id))
                },
                onRole: (id, role) => {
                  run(s => s.setGroupRole(space.id, id, role))
                }
              }
            }
          />
        </Stack>
      </DialogContent>
    </Dialog>
  )
}

function AddRow({
  space,
  write
}: {
  space: Space
  write: ReturnType<typeof useSpaceWrite>
}): ReactElement {
  const { t } = useI18n()
  const { directory } = useServices()
  const [input, setInput] = useState('')
  const [picked, setPicked] = useState<Candidate[]>([])
  const [role, setRole] = useState<SpaceRole>('viewer')
  // The directory searches from two characters; one would list everyone.
  const query = input.trim().length >= 2 ? input.trim() : ''
  const present = new Set([
    ...space.members.map(m => `people:${m.username}`),
    ...space.groups.map(g => `groups:${g.id}`)
  ])

  const found = useQuery({
    queryKey: ['directory', query],
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<Candidate[]> => {
      const [people, groups] = await Promise.all([
        directory.people(query, 1),
        directory.groups(query, 1)
      ])
      return [
        ...people.people.map(p => ({
          kind: 'people' as const,
          id: p.username,
          label: p.displayName || p.username,
          detail: p.email
        })),
        ...groups.groups.map(g => ({
          kind: 'groups' as const,
          id: g.id,
          label: g.name
        }))
      ]
    }
  })
  const options = (found.data ?? []).filter(
    c => !present.has(`${c.kind}:${c.id}`)
  )

  return (
    <Stack spacing={1}>
      <Stack
        component="form"
        direction="row"
        spacing={2}
        className="u-flex-items-start"
        aria-label={t('members.add')}
        onSubmit={event => {
          event.preventDefault()
          // After a partial failure the people are in, only the groups remain.
          const ids = (kind: Candidate['kind']) =>
            picked
              .filter(c => c.kind === kind && !present.has(`${kind}:${c.id}`))
              .map(c => c.id)
          const people = ids('people')
          const groups = ids('groups')
          // mutate's own onSuccess is skipped when a role change or a
          // removal starts before this add settles.
          write
            .mutateAsync(async spaces => {
              if (people.length > 0)
                await spaces.addMembers(space.id, people, role)
              if (groups.length > 0)
                await spaces.linkGroups(space.id, groups, role)
            })
            .then(
              () => {
                setPicked([])
              },
              () => undefined
            )
        }}
      >
        <Autocomplete
          className="u-flex-auto"
          multiple
          size="small"
          options={options}
          value={picked}
          onChange={(_event, value: Candidate[]) => {
            setPicked(value)
          }}
          inputValue={input}
          onInputChange={(_event, value) => {
            setInput(value)
          }}
          // The directory already filtered by what was typed.
          filterOptions={x => x}
          filterSelectedOptions
          groupBy={c => t(`members.${c.kind}`)}
          getOptionLabel={c => c.label}
          getOptionKey={c => `${c.kind}:${c.id}`}
          isOptionEqualToValue={(a, b) => a.kind === b.kind && a.id === b.id}
          loading={found.isFetching}
          loadingText={t('members.searching')}
          noOptionsText={t('members.noMatches')}
          renderOption={({ key, ...props }, c) => (
            <li key={key} {...props}>
              <ListItemText
                primary={c.label}
                secondary={c.detail}
                slotProps={{
                  primary: { noWrap: true },
                  secondary: { noWrap: true }
                }}
              />
            </li>
          )}
          renderInput={params => (
            <TextField {...params} label={t('members.add')} />
          )}
        />
        <RoleSelect label={t('members.role')} value={role} onChange={setRole} />
        <Button
          type="submit"
          className="u-flex-none"
          disabled={picked.length === 0 || write.isPending}
        >
          {t('common.add')}
        </Button>
      </Stack>
      {found.isError && (
        <Alert severity="error">{t('members.searchFailed')}</Alert>
      )}
    </Stack>
  )
}

function Section({
  title,
  empty,
  rows,
  admin
}: {
  title: string
  empty: string
  rows: Row[]
  admin:
    | false
    | {
        remove: (name: string) => string
        removeIcon: typeof Trash
        onRemove: (id: string) => void
        onRole: (id: string, role: SpaceRole) => void
      }
}): ReactElement {
  const { t } = useI18n()
  const id = useId()
  return (
    <section>
      <Typography variant="subtitle2" component="h3" id={id}>
        {title}
      </Typography>
      {rows.length === 0 ? (
        <Typography color="textSecondary">{empty}</Typography>
      ) : (
        <List dense aria-labelledby={id}>
          {rows.map(row => (
            <ListItem key={row.id} gutters="disabled">
              <ListItemText
                primary={row.primary}
                secondary={row.secondary}
                slotProps={{
                  primary: { noWrap: true },
                  secondary: { noWrap: true }
                }}
              />
              <Stack
                direction="row"
                spacing={1}
                className="u-flex-items-center u-flex-none u-ml-half"
              >
                {admin ? (
                  <>
                    <RoleSelect
                      label={t('members.roleOf', { name: row.primary })}
                      value={row.role}
                      onChange={role => {
                        admin.onRole(row.id, role)
                      }}
                    />
                    <IconButton
                      aria-label={admin.remove(row.primary)}
                      onClick={() => {
                        admin.onRemove(row.id)
                      }}
                    >
                      <Icon icon={admin.removeIcon} />
                    </IconButton>
                  </>
                ) : (
                  <Chip
                    label={t(`roles.${row.role}`)}
                    size="small"
                    variant="outlined"
                  />
                )}
              </Stack>
            </ListItem>
          ))}
        </List>
      )}
    </section>
  )
}
