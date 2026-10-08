import type { SystemNotifications } from '@/application/notifications'

interface Pending {
  title: string
  body: string
}

// The browser asks for the permission on a user gesture only: the first
// notification waits for the next click or key press on the page.
export function browserNotifications(): SystemNotifications {
  const shown = new Map<string, Notification>()
  const pending = new Map<string, Pending>()
  let asking = false

  const display = (key: string, { title, body }: Pending) => {
    shown.get(key)?.close()
    const notification = new Notification(title, { tag: key, body })
    notification.onclick = () => {
      window.focus()
      notification.close()
    }
    notification.onclose = () => {
      if (shown.get(key) === notification) shown.delete(key)
    }
    shown.set(key, notification)
  }

  const askOnGesture = () => {
    if (asking) return
    asking = true
    const gesture = new AbortController()
    const ask = () => {
      gesture.abort()
      void Notification.requestPermission().then(permission => {
        asking = false
        if (permission === 'granted') {
          pending.forEach((notification, key) => {
            display(key, notification)
          })
        }
        pending.clear()
      })
    }
    for (const type of ['click', 'keydown']) {
      window.addEventListener(type, ask, {
        capture: true,
        signal: gesture.signal
      })
    }
  }

  return {
    show: (app, { tag, title, body }) => {
      if (typeof Notification === 'undefined') return
      const key = `${app}:${tag}`
      if (Notification.permission === 'granted') display(key, { title, body })
      else if (Notification.permission === 'default') {
        pending.set(key, { title, body })
        askOnGesture()
      }
    },
    close: (app, tag) => {
      const key = `${app}:${tag}`
      pending.delete(key)
      shown.get(key)?.close()
      shown.delete(key)
    }
  }
}
