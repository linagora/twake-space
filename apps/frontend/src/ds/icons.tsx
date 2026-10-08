import type { ReactElement, SVGAttributes } from 'react'

// twake-icons' Home paints its own greys, so it cannot follow a selected tab.
export function Home(props: SVGAttributes<SVGSVGElement>): ReactElement {
  return (
    <svg viewBox="0 0 48 48" {...props}>
      <path
        fillRule="evenodd"
        d="M6.001 21v26h36V21l4.292 4.293a1 1 0 0 0 1.414 0l.086-.086a1 1 0 0 0 0-1.414L38 14V4a1 1 0 0 0-1-1h-5a1 1 0 0 0-1 1v3L24.707.707a1 1 0 0 0-1.414 0L.207 23.793a1 1 0 0 0 0 1.414l.087.086a1 1 0 0 0 1.414 0L6 21ZM14 33h8v14h-8z"
      />
    </svg>
  )
}

// Material's add_24px, as in the mockups: arms of 2px. Twake's Plus is
// bolder, and drawn for a 14px box.
export function AddIcon(props: SVGAttributes<SVGSVGElement>): ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M20 13H13V20H11V13H4V11H11V4H13V11H20V13Z" />
    </svg>
  )
}

// twake-icons has no video camera.
export function Videocam(props: SVGAttributes<SVGSVGElement>): ReactElement {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <path d="M15 8v8H5V8h10m1-2H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4V7a1 1 0 0 0-1-1z" />
    </svg>
  )
}
