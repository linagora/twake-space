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

// SpotSpace: Ctrl+K (⌘K on a Mac) anywhere, again to close it. In the frame
// of an app, the key goes to the app (Chat opens its own Spotchat).
export function SpotSpace(): ReactElement | null {
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    const toggle = (event: KeyboardEvent): void => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        // Never over another dialog: it would stay open on the next space
        setIsOpen(
          open => !open && document.querySelector('[role="dialog"]') === null
        )
      }
    }
    document.addEventListener('keydown', toggle)
    return () => {
      document.removeEventListener('keydown', toggle)
    }
  }, [])

  if (!isOpen) return null
  return (
    <SpotSpaceDialog
      onClose={() => {
        setIsOpen(false)
      }}
    />
  )
}

// The spaces with news first, then the last opened; Enter opens the space.
function SpotSpaceDialog({ onClose }: { onClose: () => void }): ReactElement {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  // By id: a badge that comes in moves the spaces under the selection
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const listId = useId()
  const spaces = useSpaceList().data ?? []
  const totals = useSpaceTotals(spaces)

  const options = rankSpaces(spaces, totals, query)
  const current = Math.max(
    0,
    options.findIndex(space => space.id === selectedId)
  )
  const optionId = (index: number): string => `${listId}-${String(index)}`
  const openSpace = (space: SpaceSummary): void => {
    onClose()
    void navigate(`/spaces/${space.id}`)
  }

  return (
    <Spotlight
      label={t('spotSpace.title')}
      placeholder={t('spotSpace.placeholder')}
      value={query}
      inputProps={{
        role: 'combobox',
        'aria-autocomplete': 'list',
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
      onClose={onClose}
      onChange={value => {
        setQuery(value)
        setSelectedId(null)
      }}
      onKeyDown={event => {
        // The Enter that ends a composition (Japanese, Vietnamese…) is not a choice
        if (event.nativeEvent.isComposing) return
        if (
          (event.key === 'ArrowDown' || event.key === 'ArrowUp') &&
          options.length > 0
        ) {
          event.preventDefault()
          const step = event.key === 'ArrowDown' ? 1 : -1
          const next =
            options[(current + step + options.length) % options.length]
          setSelectedId(next?.id ?? null)
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
