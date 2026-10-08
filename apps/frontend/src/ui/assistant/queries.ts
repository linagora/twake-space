import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult
} from '@tanstack/react-query'

import type { RefusalReason, Suggestion } from '@/application/suggestions'
import { useServices } from '@/ui/services/Services'

export const SUGGESTIONS = ['suggestions']

export function useSuggestions(): UseQueryResult<Suggestion[]> {
  const { suggestions } = useServices()
  return useQuery({ queryKey: SUGGESTIONS, queryFn: () => suggestions.list() })
}

export type Answer = 'approve' | RefusalReason | 'close'

/** Tells the assistant, then marks the suggestion read so that it goes away. */
export function useAnswer(
  suggestion: Suggestion
): UseMutationResult<void, Error, Answer> {
  const { suggestions, harness } = useServices()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async answer => {
      if (harness && answer === 'approve') {
        await harness.approve(suggestion.pendingCallId)
      }
      if (harness && answer !== 'approve' && answer !== 'close') {
        await harness.refuse(suggestion.pendingCallId, answer)
      }
      await suggestions.markRead(suggestion.id)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SUGGESTIONS })
  })
}
