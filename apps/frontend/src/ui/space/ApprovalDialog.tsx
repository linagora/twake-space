import { CheckCircle, Icon } from '@linagora/twake-icons'
import {
  Autocomplete,
  Button,
  Dialog,
  DialogActions,
  Divider,
  ListItemIcon,
  ListItemText,
  TextField
} from '@linagora/twake-mui'
import { useMutation } from '@tanstack/react-query'
import { useId, useState, type ReactElement } from 'react'

import {
  APPROVAL_DETAILS,
  APPROVAL_TITLE,
  APPROVERS,
  approvalBody,
  type FeedItem
} from '@/application/feed'
import { NameAvatar } from '@/ds/AppFrame'
import { DialogFields, DialogHeader, DialogSection } from '@/ds/Dialog'
import type { MentionablePerson } from '@/ds/Feed'
import { useI18n } from '@/ui/i18n/useI18n'
import { useServices } from '@/ui/services/Services'
import { FeedFailure } from '@/ui/space/FeedFailure'

/** A new approval request: what needs approval, and the members who decide. */
export function ApprovalDialog({
  spaceId,
  people,
  onClose,
  onPublished
}: {
  spaceId: string
  people: MentionablePerson[]
  onClose: () => void
  onPublished: (item: FeedItem) => void
}): ReactElement {
  const { t } = useI18n()
  const { feed } = useServices()
  const titleId = useId()
  const requestId = useId()
  const detailsId = useId()
  const approversId = useId()
  const [request, setRequest] = useState('')
  const [details, setDetails] = useState('')
  const [approvers, setApprovers] = useState<MentionablePerson[]>([])
  const valid = request.trim() !== '' && approvers.length > 0
  const publish = useMutation({
    mutationFn: () =>
      feed.post(spaceId, approvalBody(request, details), [], {
        approval: { approvers: approvers.map(person => person.id) }
      }),
    onSuccess: onPublished
  })

  return (
    <Dialog open onClose={onClose} aria-labelledby={titleId} size="small">
      <form
        noValidate
        onSubmit={event => {
          event.preventDefault()
          if (valid && !publish.isPending) publish.mutate()
        }}
      >
        <DialogHeader
          id={titleId}
          title={t('feed.approval.title')}
          subtitle={t('feed.approval.subtitle')}
          icon={<Icon icon={CheckCircle} size={20} />}
          close={{ label: t('common.close'), onClick: onClose }}
        />
        <Divider />
        <DialogFields>
          <DialogSection label={t('feed.approval.request')} htmlFor={requestId}>
            <TextField
              id={requestId}
              fullWidth
              placeholder={t('feed.approval.requestPlaceholder')}
              value={request}
              slotProps={{ htmlInput: { maxLength: APPROVAL_TITLE.max } }}
              onChange={event => {
                setRequest(event.target.value)
              }}
            />
          </DialogSection>
          <DialogSection label={t('feed.approval.details')} htmlFor={detailsId}>
            <TextField
              id={detailsId}
              fullWidth
              multiline
              maxRows={6}
              placeholder={t('feed.approval.detailsPlaceholder')}
              value={details}
              slotProps={{ htmlInput: { maxLength: APPROVAL_DETAILS.max } }}
              onChange={event => {
                setDetails(event.target.value)
              }}
            />
          </DialogSection>
          <DialogSection
            label={t('feed.approval.approvers')}
            htmlFor={approversId}
          >
            <Autocomplete
              id={approversId}
              multiple
              options={people}
              value={approvers}
              onChange={(_event, value: MentionablePerson[]) => {
                setApprovers(value.slice(0, APPROVERS.max))
              }}
              filterSelectedOptions
              getOptionLabel={person => person.name}
              getOptionKey={person => person.id}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              noOptionsText={t('feed.approval.noApprovers')}
              slotProps={{ chip: { size: 'small' } }}
              renderOption={({ key, ...props }, person) => (
                <li key={key} {...props}>
                  <ListItemIcon>
                    <NameAvatar
                      name={person.name}
                      size="s"
                      src={person.avatar}
                    />
                  </ListItemIcon>
                  <ListItemText
                    primary={person.name}
                    secondary={person.email}
                    slotProps={{
                      primary: { noWrap: true },
                      secondary: { noWrap: true }
                    }}
                  />
                </li>
              )}
              renderInput={params => (
                <TextField
                  {...params}
                  placeholder={
                    approvers.length === 0
                      ? t('feed.approval.approversPlaceholder')
                      : undefined
                  }
                />
              )}
            />
          </DialogSection>
          <FeedFailure error={publish.error} message={t('feed.postFailed')} />
        </DialogFields>
        <Divider />
        <DialogActions>
          <Button variant="outlined" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={!valid || publish.isPending}
          >
            {t('feed.approval.publish')}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}
