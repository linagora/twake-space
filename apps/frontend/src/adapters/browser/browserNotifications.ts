import type { SystemNotifications } from '@/application/notifications'

interface Pending {
  title: string
  body: string
  onClick: () => void
}

// The browser asks for the permission on a user gesture only: the first
// notification waits for the next click or key press on the page.
export function browserNotifications(): SystemNotifications {
  const shown = new Map<string, Notification>()
  const pending = new Map<string, Pending>()
  let asking = false

  const display = (key: string, { title, body, onClick }: Pending) => {
    shown.get(key)?.close()
    const notification = new Notification(title, { tag: key, body })
    notification.onclick = () => {
      window.focus()
      onClick()
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
      // What waited is over (closed before the click): nothing to ask for
      if (pending.size === 0) {
        asking = false
        return
      }
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
    show: (app, { tag, title, body }, onClick) => {
      if (typeof Notification === 'undefined') return
      const key = `${app}:${tag}`
      if (Notification.permission === 'granted')
        display(key, { title, body, onClick })
      else if (Notification.permission === 'default') {
        pending.set(key, { title, body, onClick })
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
