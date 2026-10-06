import { expect, it, vi } from 'vitest'
import { createStreams } from './streams.ts'

const stream = (userId: string, sessionId = 's1') => ({
  sessionId,
  userId,
  send: vi.fn(),
  close: vi.fn()
})

it("sends to that person's open streams only", () => {
  const streams = createStreams()
  const alice = stream('alice')
  const bob = stream('bob')
  const closed = stream('alice')
  streams.add(alice)
  streams.add(bob)
  streams.add(closed)()

  streams.send('alice', 'spaces', {})

  expect(alice.send).toHaveBeenCalledWith('spaces', {})
  expect(bob.send).not.toHaveBeenCalled()
  expect(closed.send).not.toHaveBeenCalled()
})

it("closes a person's oldest stream past 10", () => {
  const streams = createStreams()
  const tabs = Array.from({ length: 11 }, () => stream('alice'))
  const others = stream('bob')
  streams.add(others)

  for (const tab of tabs) streams.add(tab)

  expect(tabs.filter(tab => tab.close.mock.calls.length > 0)).toEqual([tabs[0]])
  expect(others.close).not.toHaveBeenCalled()
})

it('closes the streams of a session', () => {
  const streams = createStreams()
  const ended = stream('alice', 'old')
  const current = stream('alice', 'new')
  streams.add(ended)
  streams.add(current)

  streams.closeSession('old')

  expect(ended.close).toHaveBeenCalled()
  expect(current.close).not.toHaveBeenCalled()
})
