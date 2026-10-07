import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult
} from '@tanstack/react-query'

import type {
  NewSpace,
  Space,
  SpaceApp,
  SpaceSummary,
  SpacesService
} from '@/application/spaces'
import { useServices } from '@/ui/services/Services'

export const SPACES = ['spaces']

export function useSpaceList(): UseQueryResult<SpaceSummary[]> {
  const { spaces } = useServices()
  return useQuery({ queryKey: SPACES, queryFn: () => spaces.list() })
}

export function useSpace(id: string): UseQueryResult<Space> {
  const { spaces } = useServices()
  return useQuery({
    queryKey: [...SPACES, id],
    queryFn: () => spaces.get(id),
    enabled: id !== ''
  })
}

// The spaces of the list in full, from the cache `useSpace` shares. Read
// only when `enabled`.
export function useSpaces(
  ids: string[],
  enabled: boolean
): UseQueryResult<Space>[] {
  const { spaces } = useServices()
  return useQueries({
    queries: ids.map(id => ({
      queryKey: [...SPACES, id],
      queryFn: () => spaces.get(id),
      enabled
    }))
  })
}

export function useSpaceApps(): UseQueryResult<SpaceApp[]> {
  const { spaces } = useServices()
  return useQuery({
    queryKey: [...SPACES, 'apps'],
    queryFn: () => spaces.apps()
  })
}

// The copy changes once the backend applies ldap-rest's answer, so the space
// is read again after every write, refused or not.
export function useSpaceWrite(
  id: string
): UseMutationResult<void, Error, (spaces: SpacesService) => Promise<void>> {
  const { spaces } = useServices()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: write => write(spaces),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: [...SPACES, id] })
  })
}

export function useRenameSpace(
  id: string
): UseMutationResult<void, Error, string> {
  const { spaces } = useServices()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: name => spaces.rename(id, name),
    // The list shows the name too.
    onSettled: () => queryClient.invalidateQueries({ queryKey: SPACES })
  })
}

export function useDeleteSpace(id: string): UseMutationResult<void> {
  const { spaces } = useServices()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => spaces.remove(id),
    onSuccess: () => {
      // Refetching it would only answer 404 before the page moves away.
      queryClient.removeQueries({ queryKey: [...SPACES, id] })
      return queryClient.invalidateQueries({ queryKey: SPACES })
    }
  })
}

export function useCreateSpace(): UseMutationResult<
  SpaceSummary,
  Error,
  NewSpace
> {
  const { spaces } = useServices()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: space => spaces.create(space),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SPACES })
  })
}
