import { Badge, badgeClasses, styled } from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'

// The badge sits after the label instead of over its corner, which the
// scrollable tabs would clip.
const Count = styled(Badge)(({ theme }) => ({
  marginLeft: theme.spacing(1.5),
  [`& .${badgeClasses.badge}`]: {
    position: 'static',
    transform: 'none'
  }
}))

// A label with its count after it; no count, no badge. `count` is what is
// shown ("3", "99+"): the caller names the count for assistive technology.
export function CountedLabel({
  label,
  count
}: {
  label: ReactNode
  count: string | null
}): ReactElement {
  return (
    <>
      {label}
      {count !== null && <Count color="primary" badgeContent={count} />}
    </>
  )
}
