import { Button, Empty } from '@linagora/twake-mui'
import type { ReactElement } from 'react'
import {
  isRouteErrorResponse,
  Link as RouterLink,
  useRouteError
} from 'react-router'

import { Page } from '@/ds/Page'
import { useI18n } from '@/ui/i18n/useI18n'
import { useDocumentTitle } from '@/ui/useDocumentTitle'

export function ErrorScreen(): ReactElement {
  const { t } = useI18n()
  const error = useRouteError()
  const kind =
    !error || (isRouteErrorResponse(error) && error.status === 404)
      ? 'notFound'
      : 'failed'
  const title = t(`errors.${kind}`)
  useDocumentTitle(title)

  return (
    <Page>
      <Empty
        title={title}
        text={t(`errors.${kind}Hint`)}
        componentsProps={{ title: { component: 'h1' } }}
      >
        <Button
          variant="contained"
          component={RouterLink}
          to="/"
          className="u-mt-1-half"
        >
          {t('space.back')}
        </Button>
      </Empty>
    </Page>
  )
}
