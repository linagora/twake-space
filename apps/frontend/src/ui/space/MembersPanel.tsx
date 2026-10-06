import { Icon, Trash, Unlink } from '@linagora/twake-icons'
import {
  Button,
  Chip,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography
} from '@linagora/twake-mui'
import { useId, useState, type ReactElement } from 'react'

import type { Space, SpaceRole, SpacesService } from '@/application/spaces'
import { useI18n } from '@/ui/i18n/useI18n'
import { AddToSpaceDialog } from '@/ui/space/AddToSpaceDialog'
import { RoleSelect } from '@/ui/space/RoleSelect'
import { WriteError } from '@/ui/space/WriteError'
import { useSpaceWrite } from '@/ui/spaces/queries'

interface Row {
  id: string
  primary: string
  secondary?: string
  role: SpaceRole
}

export function MembersPanel({ space }: { space: Space }): ReactElement {
  const { t } = useI18n()
  const write = useSpaceWrite(space.id)
  const [adding, setAdding] = useState<'people' | 'groups' | null>(null)
  const isAdmin = space.role === 'admin'
  const run = (change: (spaces: SpacesService) => Promise<void>) => {
    write.mutate(change)
  }

  return (
    <>
      <WriteError error={write.error} className="u-mb-1" />
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
            add: t('members.addPeople'),
            onAdd: () => {
              setAdding('people')
            },
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
            add: t('members.linkGroups'),
            onAdd: () => {
              setAdding('groups')
            },
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
      {adding && (
        <AddToSpaceDialog
          kind={adding}
          space={space}
          onClose={() => {
            setAdding(null)
          }}
        />
      )}
    </>
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
        add: string
        onAdd: () => void
        remove: (name: string) => string
        removeIcon: typeof Trash
        onRemove: (id: string) => void
        onRole: (id: string, role: SpaceRole) => void
      }
}): ReactElement {
  const { t } = useI18n()
  const id = useId()
  return (
    <section className="u-mb-1">
      <Stack
        direction="row"
        className="u-flex-items-center u-flex-justify-between"
      >
        <Typography variant="h6" component="h2" id={id}>
          {title}
        </Typography>
        {admin && (
          <Button variant="text" onClick={admin.onAdd}>
            {admin.add}
          </Button>
        )}
      </Stack>
      {rows.length === 0 ? (
        <Typography color="textSecondary">{empty}</Typography>
      ) : (
        <List aria-labelledby={id}>
          {rows.map(row => (
            <ListItem key={row.id}>
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
