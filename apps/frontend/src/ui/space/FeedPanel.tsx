import { Alert, CircularProgress } from '@linagora/twake-mui'
import { useQuery } from '@tanstack/react-query'
import type { ReactElement } from 'react'

import { useI18n } from '@/ui/i18n/useI18n'
import { useServices } from '@/ui/services/Services'

export function FeedPanel({
  serverName
}: {
  serverName: string
}): ReactElement | null {
  const { t } = useI18n()
  const { matrix } = useServices()
  const signIn = useQuery({
    queryKey: ['matrix', serverName],
    queryFn: () => matrix.signIn(serverName),
    // A login token works once.
    retry: false,
    staleTime: Infinity
  })

  if (signIn.isError) {
    return <Alert severity="error">{t('feed.signInFailed')}</Alert>
  }
  if (!signIn.data) {
    return <CircularProgress aria-label={t('feed.signingIn')} />
  }
  return null
}
