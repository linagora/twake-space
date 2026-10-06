export type SpaceRole = 'viewer' | 'editor' | 'admin'

export interface SpaceSummary {
  id: string
  name: string
  role: SpaceRole
}

export type ResourceKind =
  'matrix_space' | 'tasks' | 'drive' | 'mailbox' | 'calendar'

export interface Space extends SpaceSummary {
  chat: boolean
  mail: boolean
  /** The Matrix server name of the organization's homeserver, once known. */
  serverName: string | null
  /** An id of null: the app is still preparing the resource. */
  resources: { kind: ResourceKind; id: string | null }[]
}

export interface SpacesService {
  list: () => Promise<SpaceSummary[]>
  get: (id: string) => Promise<Space>
  create: (name: string) => Promise<SpaceSummary>
}
