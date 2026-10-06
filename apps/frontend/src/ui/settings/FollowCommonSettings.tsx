import { useColorScheme } from '@linagora/twake-mui'
import { useLayoutEffect, type ReactElement, type ReactNode } from 'react'

import { I18nProvider } from '@/ui/i18n/I18nProvider'
import { resolveLanguage } from '@/ui/i18n/languages'
import { useI18n } from '@/ui/i18n/useI18n'
import { useCommonSettings } from '@/ui/settings/useCommonSettings'

export function FollowCommonSettings({
  children
}: {
  children: ReactNode
}): ReactElement {
  const { lang } = useI18n()
  const { settings, isSuccess } = useCommonSettings()
  const { setMode } = useColorScheme()
  const theme = settings.theme === 'auto' ? null : settings.theme

  // A failed read keeps the mode MUI stored from the last one.
  useLayoutEffect(() => {
    if (isSuccess) setMode(theme ?? 'system')
  }, [isSuccess, theme, setMode])

  return (
    <I18nProvider lang={resolveLanguage([settings.language, lang])}>
      {children}
    </I18nProvider>
  )
}
