import { CrossMedium, Icon, Previous } from '@linagora/twake-icons'
import { Box, IconButton, Typography } from '@linagora/twake-mui'
import type { ReactElement, ReactNode } from 'react'

interface HeaderAction {
  label: string
  onClick: () => void
}

// A small label over its field, padded as the header.
export function DialogSection({
  label,
  htmlFor,
  children
}: {
  label: string
  htmlFor: string
  children: ReactNode
}): ReactElement {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        px: { xs: 2, md: 3 },
        py: 2
      }}
    >
      <Typography
        component="label"
        htmlFor={htmlFor}
        sx={{
          fontSize: 12,
          fontWeight: 500,
          lineHeight: '15.8px',
          letterSpacing: 0.5
        }}
      >
        {label}
      </Typography>
      {children}
    </Box>
  )
}

// Back, title and close on one 56px row, as in the Twake dialogs. With a
// subtitle, the title shrinks to stack over it, after a round icon.
export function DialogHeader({
  id,
  title,
  subtitle,
  icon,
  back,
  close
}: {
  id: string
  title: ReactNode
  subtitle?: string
  icon?: ReactNode
  back?: HeaderAction | undefined
  close: HeaderAction
}): ReactElement {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        px: { xs: 2, md: subtitle ? 3 : 4 },
        py: 1
      }}
    >
      {back && (
        <IconButton
          size="medium"
          aria-label={back.label}
          onClick={back.onClick}
        >
          <Icon icon={Previous} />
        </IconButton>
      )}
      {icon && (
        <Box
          aria-hidden
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flex: '0 0 auto',
            width: 32,
            height: 32,
            mr: 0.5,
            borderRadius: '50%',
            color: 'common.white',
            backgroundImage:
              'linear-gradient(135.5deg, rgb(129, 234, 212) 14.8%, rgb(98, 198, 183) 96%)'
          }}
        >
          {icon}
        </Box>
      )}
      {subtitle ? (
        <Box sx={{ flex: '1 1 auto', minWidth: 0 }}>
          <Typography
            id={id}
            component="h2"
            sx={{
              fontSize: 14,
              fontWeight: 500,
              lineHeight: '18.4px',
              letterSpacing: 0.1
            }}
          >
            {title}
          </Typography>
          <Typography
            color="textSecondary"
            sx={{
              fontSize: 12,
              fontWeight: 500,
              lineHeight: '15.8px',
              letterSpacing: 0.5
            }}
          >
            {subtitle}
          </Typography>
        </Box>
      ) : (
        <Typography
          id={id}
          variant="h4"
          component="h2"
          sx={{ flex: '1 1 auto', minWidth: 0 }}
        >
          {title}
        </Typography>
      )}
      <IconButton
        size="medium"
        aria-label={close.label}
        onClick={close.onClick}
        sx={{ color: 'text.secondary' }}
      >
        <Icon icon={CrossMedium} />
      </IconButton>
    </Box>
  )
}
