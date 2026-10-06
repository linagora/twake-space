export type SpaceRole = 'viewer' | 'editor' | 'admin'

export interface SpaceSummary {
  id: string
  name: string
  role: SpaceRole
  /** The avatar color picked at creation. */
  color: string | null
}

export type SpaceApp = 'feed' | 'chat' | 'tasks' | 'drive' | 'mail' | 'calendar'

export interface NewSpace {
  name: string
  description: string
  color: string | null
  apps: SpaceApp[]
}

export type ResourceKind =
  'matrix_space' | 'project' | 'drive' | 'mailbox' | 'calendar'

/** A person given a role on the space directly. */
export interface Member {
  id: string
  username: string
  email: string
  displayName: string | null
  role: SpaceRole
}

/** An organization group whose members all get its role on the space. */
export interface LinkedGroup {
  id: string
  name: string
  role: SpaceRole
}

export interface Space extends SpaceSummary {
  createdAt: string
  description: string
  /** The apps that have a tab when this deployment provides them. */
  apps: SpaceApp[]
  chat: boolean
  mail: boolean
  /** The organization's Matrix homeserver, once known. */
  homeserverUrl: string | null
  members: Member[]
  groups: LinkedGroup[]
  /**
   * One entry per app this deployment provides. An id of null: the app is
   * still preparing the resource.
   */
  resources: { kind: ResourceKind; id: string | null }[]
}

/**
 * What a write rejects with when the backend refuses it. `code` is the
 * reason, for example ldap-rest refusing to remove the last admin.
 */
export interface Refusal {
  status: number
  code: string | null
}

export function isRefusal(error: unknown): error is Refusal {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    typeof error.status === 'number'
  )
}

/** Every write but create needs the caller to be an admin of the space. */
export interface SpacesService {
  list: () => Promise<SpaceSummary[]>
  get: (id: string) => Promise<Space>
  /** The apps the deployment and the organization provide to a new space. */
  apps: () => Promise<SpaceApp[]>
  create: (space: NewSpace) => Promise<SpaceSummary>
  rename: (id: string, name: string) => Promise<void>
  remove: (id: string) => Promise<void>
  addMembers: (
    id: string,
    usernames: string[],
    role: SpaceRole
  ) => Promise<void>
  setMemberRole: (id: string, userId: string, role: SpaceRole) => Promise<void>
  removeMember: (id: string, userId: string) => Promise<void>
  linkGroups: (id: string, groupIds: string[], role: SpaceRole) => Promise<void>
  setGroupRole: (id: string, groupId: string, role: SpaceRole) => Promise<void>
  unlinkGroup: (id: string, groupId: string) => Promise<void>
}
