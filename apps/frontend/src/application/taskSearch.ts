import { spaceResourceId } from '@/application/badges'
import type { Space } from '@/application/spaces'
import { isTabReady } from '@/application/spaceTabs'

export interface FoundTask {
  key: string
  title: string
  boardId: string
  projectId: string
}

/** Twake Tasks' search, across every board the user can see. */
export interface TaskSearchService {
  search: (q: string) => Promise<FoundTask[]>
}

// A task of a project no space shows in its Tasks tab stays out: it opens
// nowhere here.
export function tasksInSpaces(
  found: readonly FoundTask[],
  spaces: readonly Space[]
): { space: Space; task: FoundTask }[] {
  const byProject = new Map(
    spaces.flatMap(space => {
      const project = isTabReady(space, 'tasks')
        ? spaceResourceId(space, 'tasks')
        : null
      return project ? [[project, space] as const] : []
    })
  )
  return found.flatMap(task => {
    const space = byProject.get(task.projectId)
    return space ? [{ space, task }] : []
  })
}

export function taskPath(space: Space, task: FoundTask): string {
  const search = new URLSearchParams({ task: task.key }).toString()
  return `/spaces/${space.id}/tasks/boards/${encodeURIComponent(task.boardId)}?${search}`
}
