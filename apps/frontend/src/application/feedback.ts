export type FeedbackColorScheme = 'light' | 'dark' | 'system'

// Every text of the feedback form, in the user's language.
export interface FeedbackLabels {
  triggerLabel: string
  triggerAriaLabel: string
  formTitle: string
  messageLabel: string
  messagePlaceholder: string
  emailLabel: string
  emailPlaceholder: string
  submitButtonLabel: string
  cancelButtonLabel: string
  confirmButtonLabel: string
  successMessageText: string
  isRequiredLabel: string
  addScreenshotButtonLabel: string
  removeScreenshotButtonLabel: string
  highlightToolText: string
  hideToolText: string
  removeHighlightText: string
  errorEmptyMessageText: string
  errorNoClientText: string
  errorTimeoutText: string
  errorForbiddenText: string
  errorGenericText: string
}

export interface FeedbackService {
  // Shows the floating feedback button. The returned function removes it.
  mount: (
    labels: FeedbackLabels,
    colorScheme: FeedbackColorScheme
  ) => () => void
  // Tags what the user sends with the open space tab, or none.
  setSpaceTab: (tab: string | null) => void
}
