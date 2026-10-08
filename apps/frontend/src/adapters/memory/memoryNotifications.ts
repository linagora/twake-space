import type { SystemNotifications } from '@/application/notifications'

export function memoryNotifications(): SystemNotifications {
  return { show: () => undefined, close: () => undefined }
}
