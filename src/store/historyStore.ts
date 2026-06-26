import type { HistoryRecord } from '../types'

const HISTORY_KEY = 'boss-job-apply:history'

export async function loadHistory(): Promise<HistoryRecord[]> {
  const result = await chrome.storage.local.get(HISTORY_KEY)
  return result[HISTORY_KEY] ?? []
}

export async function saveHistory(history: HistoryRecord[]) {
  await chrome.storage.local.set({ [HISTORY_KEY]: history })
}

export async function appendHistory(records: HistoryRecord[]) {
  const current = await loadHistory()
  await saveHistory([...current, ...records])
}

export function countTodaySent(history: HistoryRecord[]): number {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const end = start + 24 * 60 * 60 * 1000
  return history.filter((record) => record.status === 'sent' && record.timestamp >= start && record.timestamp < end).length
}
