/** Someone in the caller's organization. */
export interface Person {
  username: string
  email: string
  displayName: string
}

export interface Group {
  id: string
  name: string
}

/** The people and groups a space admin picks from, 20 per page. */
export interface DirectoryService {
  /** A search needs at least two characters; without one, everyone. */
  people: (
    search: string,
    page: number
  ) => Promise<{ people: Person[]; hasNextPage: boolean }>
  groups: (
    search: string,
    page: number
  ) => Promise<{ groups: Group[]; hasNextPage: boolean }>
}
