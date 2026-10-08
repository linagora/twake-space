/** What the user's assistant proposes, shown until they answer or close it. */
export interface Suggestion {
  /** The notification's id. */
  id: string
  text: string
  pendingCallId: string
}

export interface SuggestionsService {
  /** The unread suggestions, oldest first. */
  list: () => Promise<Suggestion[]>
  markRead: (id: string) => Promise<void>
}

export type RefusalReason = 'another_time' | 'not_useful'

/** Twake Harness. An answer already given counts as given: no error. */
export interface HarnessService {
  approve: (pendingCallId: string) => Promise<void>
  refuse: (pendingCallId: string, reason: RefusalReason) => Promise<void>
}
