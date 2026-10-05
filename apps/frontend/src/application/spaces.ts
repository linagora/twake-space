export type SpaceRole = 'viewer' | 'editor' | 'admin'

export interface SpaceSummary {
  id: string
  name: string
  role: SpaceRole
}

export interface SpacesService {
  list: () => Promise<SpaceSummary[]>
  create: (name: string) => Promise<SpaceSummary>
}
