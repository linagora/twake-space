/**
 * The picture a person set on their Twake Workplace instance. The instance
 * answers 404 when there is none, so the initials stay.
 */
export function avatarUrl(workplaceFqdn: string | null): string | null {
  return workplaceFqdn
    ? `https://${workplaceFqdn}/public/avatar?fallback=404`
    : null
}
