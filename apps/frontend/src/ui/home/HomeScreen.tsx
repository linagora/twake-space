import {
  Alert,
  Button,
  Chip,
  CircularProgress,
  Link,
  List,
  ListItem,
  ListItemText,
  Typography
} from '@linagora/twake-mui'
import { useState, type ReactElement } from 'react'
import { Link as RouterLink } from 'react-router'

import { CreateSpaceDialog } from '@/ui/home/CreateSpaceDialog'
import { useI18n } from '@/ui/i18n/useI18n'
import { useSpaceList } from '@/ui/spaces/queries'
import { useDocumentTitle } from '@/ui/useDocumentTitle'

export function HomeScreen(): ReactElement {
  const { t } = useI18n()
  const spaces = useSpaceList()
  const [creating, setCreating] = useState(false)
  useDocumentTitle(null)

  return (
    <main className="u-p-2">
      <Typography variant="h1">{t('spaces.title')}</Typography>
      <Button
        variant="contained"
        onClick={() => {
          setCreating(true)
        }}
      >
        {t('spaces.create')}
      </Button>
      {spaces.isPending && (
        <CircularProgress aria-label={t('spaces.loading')} />
      )}
      {spaces.isError && (
        <Alert severity="error">{t('spaces.loadFailed')}</Alert>
      )}
      {spaces.data?.length === 0 && <Typography>{t('spaces.none')}</Typography>}
      {spaces.data && spaces.data.length > 0 && (
        <List>
          {spaces.data.map(space => (
            <ListItem key={space.id}>
              <ListItemText
                primary={
                  <Link component={RouterLink} to={`/spaces/${space.id}`}>
                    {space.name}
                  </Link>
                }
              />
              <Chip label={t(`roles.${space.role}`)} size="small" />
            </ListItem>
          ))}
        </List>
      )}
      {creating && (
        <CreateSpaceDialog
          onClose={() => {
            setCreating(false)
          }}
        />
      )}
    </main>
  )
}
