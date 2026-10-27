import { describe, expect, it } from 'vitest'

import type { Space } from '@/application/spaces'
import {
  tasksInSpaces,
  taskPath,
  type FoundTask
} from '@/application/taskSearch'

const space = (
  id: string,
  project: string | null,
  apps: Space['apps'] = ['tasks']
): Space =>
  ({
    id,
    apps,
    resources: [{ kind: 'project', id: project }]
  }) as Space

const task = (key: string, projectId: string): FoundTask => ({
  key,
  title: key,
  boardId: 'b 1',
  projectId
})

describe('tasksInSpaces', () => {
  it('pairs each task with the space that holds its project', () => {
    const roadmap = space('s1', 'p1')

    expect(
      tasksInSpaces(
        [task('DES-1', 'p1'), task('HOM-1', 'p9')],
        [roadmap, space('s2', null)]
      )
    ).toEqual([{ space: roadmap, task: task('DES-1', 'p1') }])
  })

  it('leaves out a space without its Tasks tab', () => {
    expect(
      tasksInSpaces([task('DES-1', 'p1')], [space('s1', 'p1', ['drive'])])
    ).toEqual([])
  })
})

describe('taskPath', () => {
  it('opens the task on its board in the Tasks tab', () => {
    expect(taskPath(space('s1', 'p1'), task('DES-1', 'p1'))).toBe(
      '/spaces/s1/tasks/boards/b%201?task=DES-1'
    )
  })
})
