import { Ai, Icon, LinkOut } from '@linagora/twake-icons'
import { Link, Stack } from '@linagora/twake-mui'
import type { ReactElement } from 'react'

import { API_REFERENCE_URL, curlExample } from '@/application/tokens'
import { CodeBlock } from '@/ds/CodeBlock'
import { Labelled, Note, Panel, Step, Steps } from '@/ds/Panel'
import { useI18n } from '@/ui/i18n/useI18n'
import { useServices } from '@/ui/services/Services'

export function Snippet({
  label,
  value,
  copyText,
  maxHeight
}: {
  label: string
  value: string
  copyText?: string
  maxHeight?: number
}): ReactElement {
  const { t } = useI18n()
  return (
    <CodeBlock
      label={label}
      value={value}
      copyLabel={t('apiTokens.copyItem', { item: label })}
      copiedMessage={t('apiTokens.copied', { item: label })}
      {...(copyText !== undefined && { copyText })}
      {...(maxHeight !== undefined && { maxHeight })}
    />
  )
}

export function ReferenceLink(): ReactElement {
  const { t } = useI18n()
  return (
    <Link href={API_REFERENCE_URL} target="_blank" rel="noreferrer">
      <Stack
        component="span"
        direction="row"
        spacing={0.5}
        className="u-flex-items-center"
      >
        <span>{t('apiTokens.reference')}</span>
        <Icon icon={LinkOut} size={14} />
      </Stack>
    </Link>
  )
}

export function QuickStart(): ReactElement {
  const { t } = useI18n()
  const { apiUrl } = useServices()
  return (
    <Panel titleId="api-quick-start" title={t('apiTokens.usage.title')}>
      <Steps>
        <Step>{t('apiTokens.usage.step1')}</Step>
        <Step>{t('apiTokens.usage.step2')}</Step>
        <Step>{t('apiTokens.usage.step3')}</Step>
      </Steps>
      <Labelled label={t('apiTokens.usage.baseUrl')}>
        <Snippet label={t('apiTokens.usage.baseUrl')} value={apiUrl} />
      </Labelled>
      <Labelled label={t('apiTokens.usage.example')}>
        <Snippet
          label={t('apiTokens.usage.example')}
          value={curlExample(apiUrl, '<token>')}
        />
      </Labelled>
      <Note icon={<Icon icon={Ai} />}>{t('apiTokens.usage.agents')}</Note>
      <ReferenceLink />
    </Panel>
  )
}
