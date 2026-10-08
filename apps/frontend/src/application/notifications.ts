/**
 * System notifications the page shows for an embedded app, whose own frame
 * may not (the browser refuses them to a cross-origin frame). One per tag
 * and app: the same tag replaces. A click on one brings the page forward
 * and calls `onClick`.
 */
export interface SystemNotifications {
  show: (
    app: string,
    notification: { tag: string; title: string; body: string },
    onClick: () => void
  ) => void
  close: (app: string, tag: string) => void
  /**
   * Whether a notification waits for the permission of the browser, which
   * it asks on a user gesture only: a click in an app's frame is not one
   * for this page
   */
  isWaiting: () => boolean
  subscribe: (listener: () => void) => () => void
  /** Asks the permission now: from a click on this page */
  allow: () => void
}
