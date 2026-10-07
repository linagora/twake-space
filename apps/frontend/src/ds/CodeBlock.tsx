import { Copy, Icon } from '@linagora/twake-icons'
import { Box, Button, IconButton, Snackbar } from '@linagora/twake-mui'
import { useRef, useState, type ReactElement } from 'react'

const ON_DARK = {
  color: 'inherit',
  bgcolor: 'rgba(255, 255, 255, 0.08)',
  '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.16)' }
}

// Dark in both themes, like a terminal, so a snippet reads as code at a glance.
// copyText swaps the copy icon for a labelled button, for the one snippet that
// matters most on the screen.
export function CodeBlock({
  label,
  value,
  copyLabel,
  copiedMessage,
  copyText,
  maxHeight
}: {
  label: string
  value: string
  copyLabel: string
  copiedMessage: string
  copyText?: string
  maxHeight?: number
}): ReactElement {
  const [copied, setCopied] = useState(false)
  const pre = useRef<HTMLPreElement>(null)
  // The clipboard API is missing on an insecure origin and may be denied:
  // selecting the text then leaves the user one Ctrl+C away.
  const selectText = () => {
    if (pre.current) window.getSelection()?.selectAllChildren(pre.current)
  }
  const copy = () => {
    Promise.resolve()
      .then(() => navigator.clipboard.writeText(value))
      .then(() => {
        setCopied(true)
      }, selectText)
  }
  return (
    <Box
      sx={{
        position: 'relative',
        borderRadius: '12px',
        bgcolor: '#161925',
        color: '#e7e9f2'
      }}
    >
      <Box
        component="pre"
        ref={pre}
        aria-label={label}
        tabIndex={0}
        sx={{
          m: 0,
          py: 1.5,
          pl: 2,
          pr: copyText ? 13 : 6,
          fontFamily:
            'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
          fontSize: 13,
          lineHeight: 1.6,
          whiteSpace: 'pre-wrap',
          overflowWrap: 'anywhere',
          overflow: 'auto',
          maxHeight,
          borderRadius: '12px',
          scrollbarColor: 'rgba(255, 255, 255, 0.3) transparent',
          '&:focus-visible': { outline: 2, outlineColor: 'primary.main' }
        }}
      >
        {value}
      </Box>
      {copyText ? (
        <Button
          size="small"
          aria-label={copyLabel}
          startIcon={<Icon icon={Copy} size={16} />}
          onClick={copy}
          sx={{ position: 'absolute', top: 8, right: 8, ...ON_DARK }}
        >
          {copyText}
        </Button>
      ) : (
        <IconButton
          size="small"
          aria-label={copyLabel}
          onClick={copy}
          sx={{ position: 'absolute', top: 8, right: 8, ...ON_DARK }}
        >
          <Icon icon={Copy} size={16} />
        </IconButton>
      )}
      <Snackbar
        open={copied}
        autoHideDuration={3000}
        onClose={() => {
          setCopied(false)
        }}
        message={copiedMessage}
      />
    </Box>
  )
}
