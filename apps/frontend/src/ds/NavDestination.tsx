import { NavLink, styled } from '@linagora/twake-mui'
import type { ComponentType, ReactElement, ReactNode } from 'react'

interface LinkProps {
  className?: string
  children?: ReactNode
}

const Anchor = styled('a')({
  display: 'block',
  width: '100%',
  color: 'inherit',
  textDecoration: 'none'
})

// twake-mui's NavLink is a plain button: the router link around it keeps the
// href and aria-current, and takes the keyboard focus. The router stays out
// of ds/, so `link` is the caller's link component.
export function NavDestination<Props extends object>({
  link,
  linkProps,
  selected,
  children
}: {
  link: ComponentType<Props & LinkProps>
  linkProps: Props
  selected: boolean
  children: ReactNode
}): ReactElement {
  return (
    <Anchor as={link} {...linkProps}>
      <NavLink selected={selected} role="presentation" tabIndex={-1}>
        {children}
      </NavLink>
    </Anchor>
  )
}
