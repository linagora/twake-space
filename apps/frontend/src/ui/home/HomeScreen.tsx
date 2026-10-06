import { Calendar, Icon, Plus } from '@linagora/twake-icons'
import { Alert, Button, Chip, Typography } from '@linagora/twake-mui'
import { useId, useState, type ReactElement } from 'react'
import { Link as RouterLink } from 'react-router'

import spaceTile from '@/assets/space.svg'
import { NameAvatar } from '@/ds/AppFrame'
import { CardGrid, CreateCard, SpaceCard } from '@/ds/Card'
import { LoadingRows, Page, TileEmpty } from '@/ds/Page'
import { CreateSpaceDialog } from '@/ui/home/CreateSpaceDialog'
import { useI18n } from '@/ui/i18n/useI18n'
import { useSession } from '@/ui/session/SessionGate'
import { useSpaceList } from '@/ui/spaces/queries'
import { useDocumentTitle } from '@/ui/useDocumentTitle'

function greetingKey(hour: number): 'morning' | 'afternoon' | 'evening' {
  if (hour < 12) return 'morning'
  if (hour < 18) return 'afternoon'
  return 'evening'
}

export function HomeScreen(): ReactElement {
  const { t, lang } = useI18n()
  const { user } = useSession()
  const spaces = useSpaceList()
  const [creating, setCreating] = useState(false)
  const allId = useId()
  useDocumentTitle(null)
  const now = new Date()
  const name = user.name?.split(' ')[0] ?? user.email?.split('@')[0] ?? ''
  const startCreating = (): void => {
    setCreating(true)
  }

  return (
    <Page>
      <div className="u-flex u-flex-wrap u-flex-items-center u-flex-justify-between">
        {/* Below lg the mobile bar already shows the app name */}
        <Typography variant="h3" component="p" className="u-dn-m">
          {t('app.name')}
        </Typography>
        <Typography
          variant="subtitle1"
          component="p"
          className="u-flex u-flex-items-center"
        >
          <Icon icon={Calendar} className="u-mr-half" />
          {new Intl.DateTimeFormat(lang, {
            weekday: 'long',
            month: 'long',
            day: 'numeric'
          }).format(now)}
        </Typography>
      </div>
      <Typography variant="h2" component="h1" className="u-mt-1 u-mb-1-half">
        {t(`home.${greetingKey(now.getHours())}`, { name })}
      </Typography>
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
          <div className="u-mt-1-half">
            <Button
              variant="contained"
              startIcon={<Icon icon={Plus} />}
              onClick={startCreating}
            >
              {t('spaces.create')}
            </Button>
          </div>
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
        <section aria-labelledby={allId}>
          <Typography
            id={allId}
            variant="subtitle1"
            component="h2"
            className="u-mb-1"
          >
            {t('spaces.all')}
          </Typography>
          <CardGrid>
            <CreateCard
              icon={<Icon icon={Plus} />}
              title={t('spaces.create')}
              text={t('spaces.createHint')}
              onClick={startCreating}
            />
            {spaces.data.map(space => (
              <SpaceCard
                key={space.id}
                avatar={
                  <NameAvatar name={space.name} color={space.color} size="s" />
                }
                link={
                  <RouterLink to={`/spaces/${space.id}`}>
                    {space.name}
                  </RouterLink>
                }
              />
            ))}
          </CardGrid>
        </section>
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
