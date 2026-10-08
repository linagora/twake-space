import { Icon, Pen } from '@linagora/twake-icons'
import { CircularProgress, IconButton, Snackbar } from '@linagora/twake-mui'
import { useRef, useState, type ReactElement } from 'react'

import { isRefusal } from '@/application/spaces'
import { useI18n } from '@/ui/i18n/useI18n'
import { useSetBanner } from '@/ui/spaces/queries'

// What the backend takes
const TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
const MAX_BYTES = 5 * 1024 * 1024

export function BannerButton({ spaceId }: { spaceId: string }): ReactElement {
  const { t } = useI18n()
  const input = useRef<HTMLInputElement>(null)
  const setBanner = useSetBanner(spaceId)
  const [notice, setNotice] = useState<string | null>(null)

  const upload = (file: File) => {
    if (!TYPES.includes(file.type) || file.size > MAX_BYTES) {
      setNotice(t('spaceHome.banner.invalid'))
      return
    }
    setBanner.mutate(file, {
      onError: error => {
        // A proxy in front of the backend, nginx or an ingress, may cap the
        // body below 5 MB and refuse it with a 413 of its own.
        const status = isRefusal(error) ? error.status : null
        setNotice(
          t(
            status === 413
              ? 'spaceHome.banner.tooLarge'
              : status === 415
                ? 'spaceHome.banner.unsupported'
                : 'spaceHome.banner.failed'
          )
        )
      }
    })
  }

  return (
    <>
      <IconButton
        size="small"
        aria-label={t(
          setBanner.isPending
            ? 'spaceHome.banner.uploading'
            : 'spaceHome.banner.edit'
        )}
        // Not `disabled`, which would drop the keyboard focus for the upload.
        aria-disabled={setBanner.isPending}
        onClick={() => {
          if (!setBanner.isPending) input.current?.click()
        }}
      >
        {setBanner.isPending ? (
          <CircularProgress size={16} color="inherit" />
        ) : (
          <Icon icon={Pen} size={16} />
        )}
      </IconButton>
      <input
        ref={input}
        type="file"
        accept={TYPES.join(',')}
        hidden
        data-testid="banner-file"
        onChange={event => {
          const file = event.target.files?.[0]
          // The same file picked again still fires a change.
          event.target.value = ''
          if (file) upload(file)
        }}
      />
      <Snackbar
        open={notice !== null}
        autoHideDuration={5000}
        onClose={() => {
          setNotice(null)
        }}
        message={notice}
      />
    </>
  )
}
