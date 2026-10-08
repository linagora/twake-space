import { describe, expect, it } from 'vitest'

import {
  assistantService,
  parseAssistantMessage
} from '@/application/assistant'

describe('assistantService', () => {
  it('frames the first service of the intent', () => {
    expect(
      assistantService({
        id: 'i1',
        services: [{ href: 'https://assistant.alice.test/intents/?intent=i1' }]
      })
    ).toEqual({
      intentId: 'i1',
      href: 'https://assistant.alice.test/intents/?intent=i1',
      origin: 'https://assistant.alice.test'
    })
  })

  it('has no service without an assistant', () => {
    expect(assistantService({ id: 'i1', services: [] })).toBe(null)
    expect(
      assistantService({ id: 'i1', services: [{ href: 'not a url' }] })
    ).toBe(null)
  })
})

describe('parseAssistantMessage', () => {
  it('reads the messages of its intent', () => {
    expect(parseAssistantMessage({ type: 'intent-i1:ready' }, 'i1')).toEqual({
      kind: 'ready'
    })
    expect(
      parseAssistantMessage(
        {
          type: 'intent-i1:result',
          result: { answerAction: 'post', text: 'Hello', format: 'markdown' }
        },
        'i1'
      )
    ).toEqual({
      kind: 'result',
      result: { answerAction: 'post', text: 'Hello' }
    })
  })

  it('ignores other intents, other messages and capability calls', () => {
    expect(parseAssistantMessage({ type: 'intent-i2:ready' }, 'i1')).toBe(null)
    expect(parseAssistantMessage({ type: 'intent-i1:resize' }, 'i1')).toBe(null)
    expect(parseAssistantMessage('intent-i1:ready', 'i1')).toBe(null)
    expect(
      parseAssistantMessage(
        {
          type: 'intent-i1:result',
          result: { capability: 'insert_slide', params: {} }
        },
        'i1'
      )
    ).toBe(null)
  })
})
