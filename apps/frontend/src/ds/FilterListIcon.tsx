import type { ReactElement, SVGAttributes } from 'react'

// Material's filter_list, as in the mockups: Twake's icons have no such glyph.
export function FilterListIcon(
  props: SVGAttributes<SVGSVGElement>
): ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M10 18h4v-2h-4v2ZM3 6v2h18V6H3Zm3 7h12v-2H6v2Z" />
    </svg>
  )
}
