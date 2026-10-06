import { Icon, Plus } from '@linagora/twake-icons'
import { Alert, Button, Chip, Typography } from '@linagora/twake-mui'
import { useState, type ReactElement } from 'react'
import { Link as RouterLink } from 'react-router'

import spaceTile from '@/assets/space.svg'
import { NameAvatar } from '@/ds/AppFrame'
import {
  LoadingRows,
  Page,
  PageHeader,
  Row,
  RowList,
  TileEmpty
} from '@/ds/Page'
import { CreateSpaceDialog } from '@/ui/home/CreateSpaceDialog'
import { useI18n } from '@/ui/i18n/useI18n'
import { useSpaceList } from '@/ui/spaces/queries'
import { useDocumentTitle } from '@/ui/useDocumentTitle'

export function HomeScreen(): ReactElement {
  const { t } = useI18n()
  const spaces = useSpaceList()
  const [creating, setCreating] = useState(false)
  useDocumentTitle(null)
  const create = (
    <Button
      variant="contained"
      startIcon={<Icon icon={Plus} />}
      onClick={() => {
        setCreating(true)
      }}
    >
      {t('spaces.create')}
    </Button>
  )

  return (
    <Page>
      <PageHeader
        title={t('spaces.title')}
        actions={spaces.data?.length ? create : undefined}
      />
      {spaces.isPending && (
        <LoadingRows count={4} label={t('spaces.loading')} />
      )}
      {spaces.isError && (
        <Alert severity="error">{t('spaces.loadFailed')}</Alert>
      )}
      {spaces.data?.length === 0 && (
        <TileEmpty
          icon={<img src={spaceTile} alt="" />}
          title={t('spaces.none')}
          text={t('spaces.noneHint')}
          componentsProps={{ text: { variant: 'body2' } }}
        >
          <div className="u-mt-1-half">{create}</div>
          <Chip
            className="u-mt-2-half"
            label={
              <Typography variant="caption" color="textSecondary">
                {t('spaces.channelsHint')}
              </Typography>
            }
          />
        </TileEmpty>
      )}
      {spaces.data && spaces.data.length > 0 && (
        <RowList label={t('spaces.title')}>
          {spaces.data.map(space => (
            <Row
              key={space.id}
              icon={<NameAvatar name={space.name} size="m" />}
              link={
                <RouterLink to={`/spaces/${space.id}`}>{space.name}</RouterLink>
              }
              secondary={t(`roles.${space.role}`)}
            />
          ))}
        </RowList>
      )}
      {creating && (
        <CreateSpaceDialog
          onClose={() => {
            setCreating(false)
          }}
        />
      )}
    </Page>
  )
}
