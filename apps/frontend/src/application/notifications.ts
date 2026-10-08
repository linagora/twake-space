/**
 * System notifications the page shows for an embedded app, whose own frame
 * may not (the browser refuses them to a cross-origin frame). One per tag
 * and app: the same tag replaces.
 */
export interface SystemNotifications {
  show: (
    app: string,
    notification: { tag: string; title: string; body: string }
  ) => void
  close: (app: string, tag: string) => void
}
