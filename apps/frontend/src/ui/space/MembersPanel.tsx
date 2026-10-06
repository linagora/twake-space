import {
  Chip,
  List,
  ListItem,
  ListItemText,
  Typography
} from '@linagora/twake-mui'
import { useId, type ReactElement } from 'react'

import type { Space, SpaceRole } from '@/application/spaces'
import { useI18n } from '@/ui/i18n/useI18n'

export function MembersPanel({ space }: { space: Space }): ReactElement {
  const { t } = useI18n()
  return (
    <>
      <Section
        title={t('members.members')}
        empty={t('members.noMembers')}
        rows={space.members.map(m => ({
          id: m.id,
          primary: m.username,
          secondary: m.email,
          role: m.role
        }))}
      />
      <Section
        title={t('members.groups')}
        empty={t('members.noGroups')}
        rows={space.groups.map(g => ({
          id: g.id,
          primary: g.name,
          role: g.role
        }))}
      />
    </>
  )
}

function Section({
  title,
  empty,
  rows
}: {
  title: string
  empty: string
  rows: { id: string; primary: string; secondary?: string; role: SpaceRole }[]
}): ReactElement {
  const { t } = useI18n()
  const id = useId()
  return (
    <section className="u-mb-1">
      <Typography variant="h6" component="h2" id={id}>
        {title}
      </Typography>
      {rows.length === 0 ? (
        <Typography color="textSecondary">{empty}</Typography>
      ) : (
        <List aria-labelledby={id}>
          {rows.map(row => (
            <ListItem
              key={row.id}
              secondaryAction={
                <Chip
                  label={t(`roles.${row.role}`)}
                  size="small"
                  variant="outlined"
                />
              }
            >
              <ListItemText primary={row.primary} secondary={row.secondary} />
            </ListItem>
          ))}
        </List>
      )}
    </section>
  )
}
