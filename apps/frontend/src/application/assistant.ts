// The Assistant intent of Twake Assistant, opened through the platform's
// intents: linagora/twake-assistant/docs/assistant-intent.md. The SDK
// creates the intent; the handshake with its frame is the cozy intents'
// postMessage protocol.

export const ASSISTANT_INTENT = {
  action: 'OPEN',
  type: 'io.cozy.ai.chat.conversations'
}

/** The configuration sent to the assistant in reply to its `ready`. */
export interface AssistantConfig {
  content?: string
  answerActions?: { name: string; label?: string }[]
  theme?: { type: 'light' | 'dark' }
}

/** The service of the intent: the page to frame, and where it speaks from. */
export interface AssistantService {
  intentId: string
  href: string
  origin: string
}

export function assistantService(intent: {
  id: string
  services: { href: string }[]
}): AssistantService | null {
  const href = intent.services[0]?.href
  if (href === undefined) return null
  try {
    return { intentId: intent.id, href, origin: new URL(href).origin }
  } catch {
    return null
  }
}

export interface AnswerResult {
  /** The answer action clicked, among the configured ones. */
  answerAction: string
  /** The answer, in Markdown. */
  text: string
}

export type AssistantMessage =
  | { kind: 'ready' }
  | { kind: 'readyToUse' }
  | { kind: 'cancel' }
  | { kind: 'result'; result: AnswerResult }

function isRecord(data: unknown): data is Record<string, unknown> {
  return typeof data === 'object' && data !== null
}

/** Reads a message of the assistant's frame; null for anything else. */
export function parseAssistantMessage(
  data: unknown,
  intentId: string
): AssistantMessage | null {
  if (!isRecord(data) || typeof data.type !== 'string') return null
  const prefix = `intent-${intentId}:`
  if (!data.type.startsWith(prefix)) return null
  const kind = data.type.slice(prefix.length)
  if (kind === 'ready' || kind === 'readyToUse' || kind === 'cancel') {
    return { kind }
  }
  // A capability call has no answerAction: none is declared, so none comes.
  if (
    kind === 'result' &&
    isRecord(data.result) &&
    typeof data.result.answerAction === 'string' &&
    typeof data.result.text === 'string'
  ) {
    return {
      kind: 'result',
      result: { answerAction: data.result.answerAction, text: data.result.text }
    }
  }
  return null
}
