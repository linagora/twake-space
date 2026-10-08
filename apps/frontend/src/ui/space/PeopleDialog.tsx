import { CrossCircleOutline, Icon, Team, Unlink } from '@linagora/twake-icons'
import {
  Alert,
  Autocomplete,
  Avatar,
  Button,
  Dialog,
  DialogContent,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Stack,
  TextField,
  Typography
} from '@linagora/twake-mui'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useId, useState, type ReactElement, type ReactNode } from 'react'

import type { Space, SpaceRole, SpacesService } from '@/application/spaces'
import { NameAvatar } from '@/ds/AppFrame'
import { DialogHeader } from '@/ds/Dialog'
import { useI18n } from '@/ui/i18n/useI18n'
import { useServices } from '@/ui/services/Services'
import { RoleMenu } from '@/ui/space/RoleMenu'
import { WriteError } from '@/ui/space/WriteError'
import { useSpaceWrite } from '@/ui/spaces/queries'

interface Candidate {
  kind: 'people' | 'groups'
  id: string
  label: string
  detail?: string
}

interface Row {
  key: string
  avatar: ReactNode
  primary: string
  secondary?: string
  role: SpaceRole
  remove: { label: string; icon: typeof Unlink; run: () => void }
  setRole: (role: SpaceRole) => void
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
  const rows: Row[] = [
    ...space.members.map(m => {
      const name = m.displayName ?? m.username
      return {
        key: `people:${m.id}`,
        avatar: <NameAvatar name={name} size="m" />,
        primary: name,
        secondary: m.email,
        role: m.role,
        remove: {
          label: t('members.remove', { name }),
          icon: CrossCircleOutline,
          run: () => {
            run(s => s.removeMember(space.id, m.id))
          }
        },
        setRole: (role: SpaceRole) => {
          run(s => s.setMemberRole(space.id, m.id, role))
        }
      }
    }),
    ...space.groups.map(g => ({
      key: `groups:${g.id}`,
      avatar: (
        <Avatar size="m" border aria-hidden>
          <Icon icon={Team} />
        </Avatar>
      ),
      primary: g.name,
      secondary: t('members.group'),
      role: g.role,
      remove: {
        label: t('members.unlink', { name: g.name }),
        icon: Unlink,
        run: () => {
          run(s => s.unlinkGroup(space.id, g.id))
        }
      },
      setRole: (role: SpaceRole) => {
        run(s => s.setGroupRole(space.id, g.id, role))
      }
    }))
  ]

  return (
    <Dialog open onClose={onClose} aria-labelledby={titleId} size="medium">
      <DialogHeader
        id={titleId}
        title={t(isAdmin ? 'members.inviteTitle' : 'members.title', {
          name: space.name
        })}
        close={{ label: t('common.close'), onClick: onClose }}
      />
      <DialogContent>
        <Stack spacing={1.5}>
          <WriteError error={write.error} />
          {isAdmin && <AddPeopleRow space={space} write={write} />}
          {rows.length === 0 ? (
            <Typography color="textSecondary">
              {t('members.noMembers')}
            </Typography>
          ) : (
            <List aria-label={t('members.members')}>
              {rows.map(row => (
                <ListItem key={row.key} size="small">
                  <ListItemIcon>{row.avatar}</ListItemIcon>
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
                    {isAdmin ? (
                      <>
                        <RoleMenu
                          label={t('members.roleOf', { name: row.primary })}
                          value={row.role}
                          onChange={row.setRole}
                        />
                        <IconButton
                          size="small"
                          aria-label={row.remove.label}
                          onClick={row.remove.run}
                        >
                          <Icon icon={row.remove.icon} />
                        </IconButton>
                      </>
                    ) : (
                      <Typography variant="body2" color="textSecondary">
                        {t(`roles.${row.role}`)}
                      </Typography>
                    )}
                  </Stack>
                </ListItem>
              ))}
            </List>
          )}
        </Stack>
      </DialogContent>
    </Dialog>
  )
}

export function AddPeopleRow({
  space,
  write
}: {
  space: Space
  write: ReturnType<typeof useSpaceWrite>
}): ReactElement {
  const { t } = useI18n()
  const { directory } = useServices()
  const headingId = useId()
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
    <Stack spacing={1.5}>
      <Typography id={headingId} variant="h5" component="h3">
        {t('spaceMenu.invite')}
      </Typography>
      <Stack
        component="form"
        direction="row"
        spacing={1.5}
        className="u-flex-items-center"
        aria-labelledby={headingId}
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
          forcePopupIcon={false}
          disableClearable
          groupBy={c => t(`members.${c.kind}`)}
          getOptionLabel={c => c.label}
          getOptionKey={c => `${c.kind}:${c.id}`}
          isOptionEqualToValue={(a, b) => a.kind === b.kind && a.id === b.id}
          loading={found.isFetching}
          loadingText={t('members.searching')}
          noOptionsText={t('members.noMatches')}
          slotProps={{ chip: { size: 'small' } }}
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
            <TextField
              {...params}
              placeholder={picked.length === 0 ? t('members.add') : undefined}
              slotProps={{
                ...params.slotProps,
                htmlInput: {
                  ...params.slotProps.htmlInput,
                  'aria-label': t('members.add')
                },
                input: {
                  ...params.slotProps.input,
                  // The Autocomplete reads keys bubbling from its whole root,
                  // the portaled menu included: Backspace would drop a pick,
                  // Arrow and Enter would pick a hidden option.
                  endAdornment: (
                    <span
                      role="presentation"
                      onKeyDown={event => {
                        if (event.key !== 'Escape') event.stopPropagation()
                      }}
                    >
                      <RoleMenu
                        label={t('members.role')}
                        value={role}
                        onChange={setRole}
                      />
                    </span>
                  )
                }
              }}
            />
          )}
        />
        <Button
          type="submit"
          variant="contained"
          className="u-flex-none"
          disabled={picked.length === 0 || write.isPending}
        >
          {t('members.invite')}
        </Button>
      </Stack>
      {found.isError && (
        <Alert severity="error">{t('members.searchFailed')}</Alert>
      )}
    </Stack>
  )
}
