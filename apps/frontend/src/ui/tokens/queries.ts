import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult
} from '@tanstack/react-query'

import type {
  ApiToken,
  CreatedToken,
  NewToken,
  TokenOwner,
  TokenPolicy,
  TokensService,
  TokenSpace
} from '@/application/tokens'
import { useServices } from '@/ui/services/Services'

const tokensKey = (owner: TokenOwner) => ['tokens', owner]

export function useTokens(owner: TokenOwner): UseQueryResult<ApiToken[]> {
  const { tokens } = useServices()
  return useQuery({
    queryKey: tokensKey(owner),
    queryFn: () => tokens.list(owner)
  })
}

export function useTokenPolicy(): UseQueryResult<TokenPolicy> {
  const { tokens } = useServices()
  return useQuery({
    queryKey: ['tokens', 'policy'],
    queryFn: () => tokens.policy()
  })
}

export function useOrganizationSpaces(
  enabled: boolean
): UseQueryResult<TokenSpace[]> {
  const { tokens } = useServices()
  return useQuery({
    queryKey: ['tokens', 'spaces'],
    queryFn: () => tokens.organizationSpaces(),
    enabled
  })
}

export function useCreateToken(
  owner: TokenOwner
): UseMutationResult<CreatedToken, Error, NewToken> {
  const { tokens } = useServices()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: token => tokens.create(owner, token),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: tokensKey(owner) })
  })
}

export function useTokenWrite(
  owner: TokenOwner
): UseMutationResult<void, Error, (tokens: TokensService) => Promise<void>> {
  const { tokens } = useServices()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: write => write(tokens),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: tokensKey(owner) })
  })
}
