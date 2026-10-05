import { Typography } from '@linagora/twake-mui'
import type { ReactElement } from 'react'

import { useI18n } from '@/ui/i18n/useI18n'
import { useDocumentTitle } from '@/ui/useDocumentTitle'

export function HomeScreen(): ReactElement {
  const { t } = useI18n()
  useDocumentTitle(null)

  return (
    <main className="u-p-2">
      <Typography variant="h1">{t('app.name')}</Typography>
    </main>
  )
}
