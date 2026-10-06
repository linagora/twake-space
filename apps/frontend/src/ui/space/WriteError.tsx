import { Alert } from '@linagora/twake-mui'
import type { ReactElement } from 'react'

import { isRefusal } from '@/application/spaces'
import { useI18n, type TranslationKey } from '@/ui/i18n/useI18n'

const REFUSALS = new Map<string, TranslationKey>([
  ['LAST_ADMIN', 'members.refusal.lastAdmin'],
  ['MEMBER_EXISTS', 'members.refusal.memberExists'],
  ['GROUP_ALREADY_LINKED', 'members.refusal.groupAlreadyLinked']
])

export function WriteError({
  error,
  className
}: {
  error: Error | null
  className?: string
}): ReactElement | null {
  const { t } = useI18n()
  if (!error) return null
  const code = isRefusal(error) ? error.code : undefined
  const known = code && REFUSALS.get(code)
  return (
    <Alert severity="error" className={className}>
      {known
        ? t(known)
        : code
          ? t('members.refused', { code })
          : t('members.failed')}
    </Alert>
  )
}
