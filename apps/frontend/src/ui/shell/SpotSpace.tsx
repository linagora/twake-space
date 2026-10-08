import { Box } from '@linagora/twake-mui'
import { useEffect, useId, useState, type ReactElement } from 'react'
import { useNavigate } from 'react-router'

import { badgeLabel } from '@/application/badges'
import { rankSpaces, type SpaceSummary } from '@/application/spaces'
import { NameAvatar } from '@/ds/AppFrame'
import { Spotlight, SpotlightEmpty, SpotlightOption } from '@/ds/Spotlight'
import { useI18n } from '@/ui/i18n/useI18n'
import { useSpaceTotals } from '@/ui/space/Badges'
import { useSpaceList } from '@/ui/spaces/queries'

// SpotSpace: Ctrl+K (⌘K on a Mac) anywhere, again to close it. The spaces
// with news first, then the last opened; Enter opens the space. In the frame
// of an app, the key goes to the app (Chat opens its own Spotchat).
export function SpotSpace(): ReactElement | null {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const listId = useId()
  const spaces = useSpaceList().data ?? []
  const totals = useSpaceTotals(spaces)

  useEffect(() => {
    const toggle = (event: KeyboardEvent): void => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setQuery('')
        setActive(0)
        setIsOpen(open => !open)
      }
    }
    document.addEventListener('keydown', toggle)
    return () => {
      document.removeEventListener('keydown', toggle)
    }
  }, [])

  if (!isOpen) return null
  const options = rankSpaces(spaces, totals, query)
  const current = Math.min(active, options.length - 1)
  const optionId = (index: number): string => `${listId}-${String(index)}`
  const openSpace = (space: SpaceSummary): void => {
    setIsOpen(false)
    void navigate(`/spaces/${space.id}`)
  }

  return (
    <Spotlight
      label={t('spotSpace.title')}
      placeholder={t('spotSpace.placeholder')}
      value={query}
      inputProps={{
        role: 'combobox',
        'aria-expanded': options.length > 0,
        'aria-controls': listId,
        'aria-activedescendant':
          options.length > 0 ? optionId(current) : undefined
      }}
      hints={[
        { keys: '↑↓', label: t('spotSpace.move') },
        { keys: '↵', label: t('spotSpace.open') },
        { keys: 'Esc', label: t('common.close') }
      ]}
      onClose={() => {
        setIsOpen(false)
      }}
      onChange={value => {
        setQuery(value)
        setActive(0)
      }}
      onKeyDown={event => {
        if (
          (event.key === 'ArrowDown' || event.key === 'ArrowUp') &&
          options.length > 0
        ) {
          event.preventDefault()
          const step = event.key === 'ArrowDown' ? 1 : -1
          setActive((current + step + options.length) % options.length)
        }
        const chosen = options[current]
        if (event.key === 'Enter' && chosen) {
          event.preventDefault()
          openSpace(chosen)
        }
      }}
    >
      {options.length === 0 && (
        <SpotlightEmpty text={t('shell.noSpaceFound')} />
      )}
      <Box id={listId} role="listbox" aria-label={t('shell.yourSpaces')}>
        {options.map((space, index) => {
          const total = totals.get(space.id) ?? 0
          return (
            <SpotlightOption
              key={space.id}
              id={optionId(index)}
              selected={index === current}
              label={
                total > 0
                  ? t('shell.spaceWithCount', {
                      name: space.name,
                      smart_count: total
                    })
                  : undefined
              }
              avatar={
                <NameAvatar name={space.name} color={space.color} size="s" />
              }
              primary={space.name}
              secondary={space.description || undefined}
              count={badgeLabel(total)}
              onClick={() => {
                openSpace(space)
              }}
            />
          )
        })}
      </Box>
    </Spotlight>
  )
}
