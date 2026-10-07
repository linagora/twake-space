/**
 * Each person's Twake Drive is on their own Twake Workplace instance: the
 * deployment's template, like `https://{slug}-drive.{domain}/`, filled from
 * that instance's address, like `alice.dev.twake.test`.
 */
export function driveUrl(
  template: string | null,
  workplaceFqdn: string | null
): string | null {
  const dot = workplaceFqdn?.indexOf('.') ?? -1
  if (!template || !workplaceFqdn || dot <= 0) return null
  return template
    .replaceAll('{slug}', workplaceFqdn.slice(0, dot))
    .replaceAll('{domain}', workplaceFqdn.slice(dot + 1))
}
