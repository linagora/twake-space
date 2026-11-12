import { describe, expect, it } from 'vitest'

import { parseAnswer } from '@/application/assistant'

describe('parseAnswer', () => {
  it('reads the answer the user picked', () => {
    expect(
      parseAnswer({ answerAction: 'post', text: 'Hello', format: 'markdown' })
    ).toEqual({ answerAction: 'post', text: 'Hello' })
  })

  it('ignores capability calls and anything else', () => {
    expect(parseAnswer({ capability: 'insert_slide', params: {} })).toBe(null)
    expect(parseAnswer({ text: 'Hello' })).toBe(null)
    expect(parseAnswer('Hello')).toBe(null)
    expect(parseAnswer(null)).toBe(null)
  })
})
