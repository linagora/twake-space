import { uploadMessage } from '@linagora/twake-embed'
import {
  createContext,
  use,
  useState,
  type ReactElement,
  type ReactNode
} from 'react'

// Files picked in TwakeSpace go to an app's frame, hidden or shown, which
// stores them in its resource (the space's Drive) and answers whether it did.
export interface AppUploads {
  upload: (
    app: string,
    resourceId: string,
    files: readonly File[]
  ) => Promise<void>
  // The frame of the app, once its document runs: a frame replaced or gone
  // fails the uploads it did not answer
  attach: (app: string, target: Frame, origin: string) => () => void
  settle: (app: string, id: string, ok: boolean) => void
}

type Frame = Pick<Window, 'postMessage'>

const MAX_FILES = 100

interface Pending {
  app: string
  done: (ok: boolean) => void
}

export function createAppUploads(): AppUploads {
  const frames = new Map<string, { target: Frame; origin: string }>()
  const pending = new Map<string, Pending>()
  const settle = (app: string, id: string, ok: boolean): void => {
    const upload = pending.get(id)
    if (upload?.app !== app) return
    pending.delete(id)
    upload.done(ok)
  }
  const send = (app: string, resourceId: string, files: readonly File[]) => {
    const frame = frames.get(app)
    if (!frame) return Promise.reject(new Error(`No frame for ${app}`))
    const id = crypto.randomUUID()
    return new Promise<void>((resolve, reject) => {
      pending.set(id, {
        app,
        done: ok => {
          if (ok) resolve()
          else reject(new Error(`${app} refused the upload`))
        }
      })
      frame.target.postMessage(
        uploadMessage(id, resourceId, files),
        frame.origin
      )
    })
  }
  return {
    // An app drops a message of more files than twake-embed allows
    upload: async (app, resourceId, files) => {
      for (let start = 0; start < files.length; start += MAX_FILES) {
        await send(app, resourceId, files.slice(start, start + MAX_FILES))
      }
    },
    attach: (app, target, origin) => {
      const frame = { target, origin }
      frames.set(app, frame)
      return () => {
        if (frames.get(app) === frame) frames.delete(app)
        for (const [id, upload] of pending) {
          if (upload.app === app) settle(app, id, false)
        }
      }
    },
    settle
  }
}

const AppUploadsContext = createContext<AppUploads>(createAppUploads())

export function AppUploadsProvider({
  children
}: {
  children: ReactNode
}): ReactElement {
  const [uploads] = useState(createAppUploads)
  return <AppUploadsContext value={uploads}>{children}</AppUploadsContext>
}

export function useAppUploads(): AppUploads {
  return use(AppUploadsContext)
}
