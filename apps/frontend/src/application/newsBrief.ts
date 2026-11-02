import type { Actor, FeedItem } from '@/application/feed'

/** What is new in one space since the user's last visit, newest first. */
export interface SpaceBrief {
  name: string
  mentions: number
  items: FeedItem[]
}

const TEXT_MAX = 280

function cut(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > TEXT_MAX ? `${flat.slice(0, TEXT_MAX)}…` : flat
}

function actorName(actor: Actor | null): string {
  if (actor === null || actor.type === 'deleted_user') return 'Someone'
  return actor.name ?? 'Someone'
}

// `com.twake.tasks.task.moved.v1` reads `task moved`.
function eventName(type: string): string {
  return type.split('.').slice(-3, -1).join(' ')
}

function itemLine(item: FeedItem): string {
  if (item.kind === 'post') {
    return `- ${item.time} ${actorName(item.author)} posted: ${cut(item.body)}`
  }
  const preview = item.preview ? `: ${cut(item.preview)}` : ''
  return `- ${item.time} ${actorName(item.actor)}, ${eventName(item.type)}, "${cut(item.object.title)}"${preview}`
}

/**
 * The text Twake Assistant summarises on the home: written for the model, in
 * English, whatever the language of the user.
 */
export function newsBrief(spaces: SpaceBrief[]): string {
  return spaces
    .map(space => {
      const lines = [`## ${space.name}`]
      if (space.mentions > 0) {
        lines.push(`The user has ${String(space.mentions)} unread mention(s).`)
      }
      lines.push(...space.items.map(itemLine))
      return lines.join('\n')
    })
    .join('\n\n')
}
