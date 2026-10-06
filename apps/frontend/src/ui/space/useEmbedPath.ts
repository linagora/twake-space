import { useCallback, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router'

/**
 * Keeps a framed app's path under `embed` and the tab's path under `tabPath`
 * in step: `src` opens the frame where the URL points, and `follow` puts the
 * frame's new path in the URL.
 */
export function useEmbedPath(
  appUrl: string,
  embed: string,
  tabPath: string
): { src: string; follow: (path: string) => void } {
  const navigate = useNavigate()
  const { '*': rest = '' } = useParams()
  const { search } = useLocation()
  // Set once: the frame navigates by itself, and a new src would reload it.
  const [src] = useState(
    () => new URL(`${embed}${rest ? `/${rest}` : ''}${search}`, appUrl).href
  )

  const follow = useCallback(
    (path: string) => {
      if (!path.startsWith(embed)) return
      const inEmbed = path.slice(embed.length)
      // '/embed/projects/p12' is another project.
      if (!/^([/?#]|$)/.test(inEmbed)) return
      void navigate(`${tabPath}${inEmbed}`, { replace: true })
    },
    [embed, navigate, tabPath]
  )

  return { src, follow }
}
