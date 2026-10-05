import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult
} from '@tanstack/react-query'

import type { Space, SpaceSummary } from '@/application/spaces'
import { useServices } from '@/ui/services/Services'

export const SPACES = ['spaces']

export function useSpaceList(): UseQueryResult<SpaceSummary[]> {
  const { spaces } = useServices()
  return useQuery({ queryKey: SPACES, queryFn: () => spaces.list() })
}

export function useSpace(id: string): UseQueryResult<Space> {
  const { spaces } = useServices()
  return useQuery({ queryKey: [...SPACES, id], queryFn: () => spaces.get(id) })
}

export function useCreateSpace(): UseMutationResult<
  SpaceSummary,
  Error,
  string
> {
  const { spaces } = useServices()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: name => spaces.create(name),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SPACES })
  })
}
