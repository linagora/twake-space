import { driveUrl } from '@/application/drive'
import type { EmbeddedApp } from '@/application/embeddedApps'
import { useServices } from '@/ui/services/Services'
import { useSession } from '@/ui/session/SessionGate'

// Where each embedded app is, null when not set up: one address per
// deployment, except Twake Drive, on each person's own Twake Workplace.
export function useAppUrls(): Record<EmbeddedApp, string | null> {
  const { tasksUrl, mailUrl, chatUrl, driveUrlTemplate } = useServices()
  const { user } = useSession()
  return {
    chat: chatUrl,
    tasks: tasksUrl,
    drive: driveUrl(driveUrlTemplate, user.workplaceFqdn),
    mail: mailUrl
  }
}
