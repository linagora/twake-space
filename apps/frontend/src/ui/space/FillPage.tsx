import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode
} from 'react'

// The page given to the content of a space, its open tab, until the person
// takes the chrome back: the shell, the space's header and its tabs step
// aside. It holds for one space, which the space screen gives back when it
// leaves it. Not in the address, whose search and hash belong to the
// embedded apps.
export interface FillPage {
  // The space whose content has the page, if any
  space: string | null
  fill: (space: string) => void
  leave: () => void
}

const FillPageContext = createContext<FillPage | null>(null)

export function FillPageProvider({
  children
}: {
  children: ReactNode
}): ReactElement {
  const [space, setSpace] = useState<string | null>(null)
  const leave = useCallback(() => {
    setSpace(null)
  }, [])
  const value = useMemo<FillPage>(
    () => ({ space, fill: setSpace, leave }),
    [space, leave]
  )
  return <FillPageContext value={value}>{children}</FillPageContext>
}

export function useFillPage(): FillPage {
  const value = useContext(FillPageContext)
  if (!value) throw new Error('useFillPage needs a FillPageProvider')
  return value
}
