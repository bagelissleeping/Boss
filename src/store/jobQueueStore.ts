import type { BatchRunSummary, QueueItem } from '../types'

const SUMMARY_KEY = 'boss-job-apply:last-summary'

type QueueItemInput = Omit<QueueItem, 'updatedAt'>

export async function saveBatchSummary(summary: BatchRunSummary) {
  await chrome.storage.local.set({ [SUMMARY_KEY]: summary })
}

export async function loadBatchSummary(): Promise<BatchRunSummary> {
  const result = await chrome.storage.local.get(SUMMARY_KEY)
  return result[SUMMARY_KEY] ?? { sent: [], review: [], skipped: [] }
}

export function toQueueItem(input: QueueItemInput): QueueItem {
  return {
    ...input,
    updatedAt: Date.now()
  }
}
