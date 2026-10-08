import { Button, Snackbar } from '@linagora/twake-mui'
import { useState, useSyncExternalStore, type ReactElement } from 'react'

import { useI18n } from '@/ui/i18n/useI18n'
import { useServices } from '@/ui/services/Services'

/**
 * The browser asks for the permission of notifications on a click of this
 * page only, and a click in an app's frame is not one: while a notification
 * of an app waits for it, a bar offers to allow them here.
 */
export function NotificationPermissionPrompt(): ReactElement {
  const { t } = useI18n()
  const { notifications } = useServices()
  const isWaiting = useSyncExternalStore(
    notifications.subscribe,
    notifications.isWaiting
  )
  const [isDismissed, setDismissed] = useState(false)

  return (
    <Snackbar
      open={isWaiting && !isDismissed}
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      message={t('shell.notificationPermission.message')}
      action={
        <>
          <Button
            size="small"
            onClick={() => {
              setDismissed(true)
            }}
          >
            {t('shell.notificationPermission.dismiss')}
          </Button>
          <Button
            size="small"
            variant="contained"
            onClick={() => {
              notifications.allow()
            }}
          >
            {t('shell.notificationPermission.allow')}
          </Button>
        </>
      }
    />
  )
}
