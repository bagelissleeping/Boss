import type { PageType } from '../../types'

export function detectBossPageType(url: string): PageType {
  if (url.includes('/web/geek/chat')) return 'chat'
  if (url.includes('/web/geek/job-recommend') || url.includes('/web/geek/jobs')) return 'list'
  if (url.includes('/web/geek/job')) return 'detail'
  return 'unknown'
}
