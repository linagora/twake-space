import { useEffect } from 'react'

import { useServices } from '@/ui/services/Services'

// Tags what the user reports with the open space tab, so feedback about a
// framed app reaches its team. Leaving the space clears the tag.
export function useSpaceTabTag(tab: string | null): void {
  const { feedback } = useServices()

  useEffect(() => {
    feedback?.setSpaceTab(tab)
    return () => {
      feedback?.setSpaceTab(null)
    }
  }, [feedback, tab])
}
