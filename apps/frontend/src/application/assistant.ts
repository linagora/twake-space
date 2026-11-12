// The Assistant intent of Twake Assistant, opened through the platform's
// intents: linagora/twake-assistant/docs/assistant-intent.md.

export const ASSISTANT_INTENT = {
  action: 'OPEN',
  type: 'io.cozy.ai.chat.conversations'
}

// A frame that never says `ready` shows the failure, not loading rows forever
export const ASSISTANT_READY_TIMEOUT = 60_000

/** The configuration sent to the assistant in reply to its `ready`. */
export interface AssistantConfig {
  content?: string
  answerActions?: { name: string; label?: string }[]
  /** Chips above the composer; `instructions` are for the model, in English. */
  suggestions?: { name: string; message: string; instructions?: string }[]
  theme?: { type: 'light' | 'dark' }
}

export interface AnswerResult {
  /** The answer action clicked, among the configured ones. */
  answerAction: string
  /** The answer, in Markdown. */
  text: string
}

function isRecord(data: unknown): data is Record<string, unknown> {
  return typeof data === 'object' && data !== null
}

/** Reads a result of the assistant; null for anything else. */
export function parseAnswer(result: unknown): AnswerResult | null {
  // A capability call has no answerAction: none is declared, so none comes.
  if (
    isRecord(result) &&
    typeof result.answerAction === 'string' &&
    typeof result.text === 'string'
  ) {
    return { answerAction: result.answerAction, text: result.text }
  }
  return null
}
