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

// Twake's Plus is bolder and drawn for a 14px box; the mockups use 2px arms.
export function AddIcon(props: SVGAttributes<SVGSVGElement>): ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M20 13H13V20H11V13H4V11H11V4H13V11H20V13Z" />
    </svg>
  )
}

// Twake's calendar is a heavy 48px glyph; the mockups use a 2px stroke.
export function CalendarIcon(
  props: SVGAttributes<SVGSVGElement>
): ReactElement {
  return (
    <svg viewBox="0 0 16 16" {...props}>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        d="M5.333 1.333v2.666M10.667 1.333v2.666M2 6.667h12M2 6.667v6.666c0 .737.597 1.334 1.333 1.334h9.334c.736 0 1.333-.597 1.333-1.334V6.667M2 6.667V4c0-.737.597-1.334 1.333-1.334h9.334C13.403 2.666 14 3.263 14 4v2.667"
      />
    </svg>
  )
}

export function SpaceCubeIcon(
  props: SVGAttributes<SVGSVGElement>
): ReactElement {
  return (
    <svg viewBox="0 0 16 16" {...props}>
      <path d="M14.6016 3.72457C14.6232 3.71199 14.6411 3.69397 14.6535 3.67233C14.6659 3.65068 14.6725 3.62615 14.6725 3.60119C14.6725 3.57622 14.6659 3.55169 14.6535 3.53004C14.6411 3.5084 14.6232 3.49039 14.6016 3.4778L9.14715 0.30883C8.79815 0.106536 8.40191 0 7.99851 0C7.59512 0 7.19888 0.106536 6.84988 0.30883L1.39648 3.4778C1.37492 3.49039 1.35703 3.5084 1.3446 3.53004C1.33216 3.55169 1.32562 3.57622 1.32562 3.60119C1.32562 3.62615 1.33216 3.65068 1.3446 3.67233C1.35703 3.69397 1.37492 3.71199 1.39648 3.72457L7.92727 7.56633C7.94924 7.57927 7.97427 7.58609 7.99976 7.58609C8.02526 7.58609 8.05029 7.57927 8.07226 7.56633L14.6016 3.72457ZM0.785114 4.69626C0.763331 4.68368 0.738613 4.67708 0.71346 4.67712C0.688307 4.67716 0.663611 4.68384 0.641868 4.69649C0.620126 4.70913 0.602108 4.7273 0.589638 4.74914C0.577167 4.77099 0.570686 4.79573 0.570849 4.82089V11.0306C0.571388 11.3299 0.650259 11.6238 0.799617 11.8831C0.948975 12.1424 1.16362 12.3581 1.42219 12.5087L7.21305 15.9809C7.23476 15.9934 7.25938 16 7.28444 16C7.3095 16 7.33412 15.9934 7.35583 15.9809C7.37755 15.9684 7.39558 15.9504 7.40813 15.9287C7.42067 15.907 7.42729 15.8824 7.42732 15.8573V8.65265C7.42729 8.6276 7.42068 8.603 7.40815 8.58132C7.39561 8.55963 7.37759 8.54162 7.3559 8.52909L0.785114 4.69626ZM8.57006 8.67765V15.8555C8.57009 15.8806 8.57671 15.9052 8.58926 15.9269C8.6018 15.9486 8.61984 15.9666 8.64155 15.9791C8.66326 15.9916 8.68788 15.9982 8.71294 15.9982C8.73801 15.9982 8.76263 15.9916 8.78433 15.9791L14.5748 12.5069C14.8332 12.3565 15.0478 12.1411 15.1972 11.8821C15.3466 11.6232 15.4256 11.3296 15.4265 11.0306V4.82089C15.4264 4.79586 15.4198 4.77129 15.4072 4.74964C15.3946 4.728 15.3766 4.71004 15.3549 4.69756C15.3332 4.68508 15.3086 4.67852 15.2836 4.67855C15.2585 4.67857 15.2339 4.68517 15.2123 4.69769L8.64149 8.55445C8.61984 8.56694 8.60186 8.5849 8.58933 8.60652C8.5768 8.62813 8.57015 8.65266 8.57006 8.67765Z" />
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

// Material's keyboard_arrow_down, as in the mockup's filter chip: Twake's
// Down is an arrow.
export function ChevronDownIcon(
  props: SVGAttributes<SVGSVGElement>
): ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41Z" />
    </svg>
  )
}

// The mockup's more_vert: three dots, one over the other. Twake's Dots lie flat.
export function MoreVertIcon(
  props: SVGAttributes<SVGSVGElement>
): ReactElement {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" {...props}>
      <path d="M8 5.333A1.333 1.333 0 1 0 8 2.667a1.333 1.333 0 0 0 0 2.666Zm0 1.334a1.333 1.333 0 1 0 0 2.666 1.333 1.333 0 0 0 0-2.666Zm0 4a1.333 1.333 0 1 0 0 2.666 1.333 1.333 0 0 0 0-2.666Z" />
    </svg>
  )
}

// A smiling face with a plus: the button that adds a reaction.
export function AddReactionIcon(
  props: SVGAttributes<SVGSVGElement>
): ReactElement {
  return (
    <svg viewBox="0 0 20 20" {...props}>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        d="M17.2 9.6A7.25 7.25 0 1 1 10.4 2.8M7 11.9a3.9 3.9 0 0 0 6 0M14.5 1.5v4M12.5 3.5h4"
      />
      <circle cx="7.2" cy="8.4" r="0.9" fill="currentColor" />
      <circle cx="12.6" cy="9.6" r="0.9" fill="currentColor" />
    </svg>
  )
}

// Material's tag_faces, the mockup's emoji button: a smiling face.
export function EmojiIcon(props: SVGAttributes<SVGSVGElement>): ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2ZM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8Zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5Zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11Zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5Z" />
    </svg>
  )
}
