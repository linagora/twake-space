// Texts of the feedback form, by Sentry's label name.
export type FeedbackLabels = Readonly<Record<string, string>>

export interface FeedbackService {
  // Whether the feedback form is on: without it the UI shows no button.
  enabled: boolean
  // Opens the feedback form when `el` is clicked. The returned function
  // detaches it and removes the form.
  attach: (el: HTMLElement, labels: FeedbackLabels) => () => void
  // Follows the light or dark theme of the app in the form.
  setColorScheme: (scheme: 'light' | 'dark' | 'system') => void
  // Tags what the user sends with the open space tab, or none.
  setSpaceTab: (tab: string | null) => void
}
