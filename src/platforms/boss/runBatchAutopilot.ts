import type { ExtensionRules } from '../../core/rules/defaultRules'
import { evaluateJob } from '../../core/rules/decisionPolicy'
import type { BatchRunSummary, HistoryRecord, JobSnapshot, QueueItem } from '../../types'

interface VisibleJobCard {
  element: HTMLElement
  anchor: HTMLAnchorElement
  snapshot: JobSnapshot
}

interface ProgressEvent {
  phase: 'starting' | 'processing' | 'scrolling' | 'finished'
  currentCompany?: string
  currentJobTitle?: string
  sentCount: number
  reviewCount: number
  skippedCount: number
  rounds: number
  message: string
}

function emitProgress(progress: ProgressEvent) {
  chrome.runtime.sendMessage({ type: 'BATCH_PROGRESS', progress }).catch(() => undefined)
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim()
}

function text(el: Element | null | undefined): string {
  return normalizeText(el?.textContent)
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isVisible(el: Element): el is HTMLElement {
  if (!(el instanceof HTMLElement)) return false
  const rect = el.getBoundingClientRect()
  return rect.width > 0 && rect.height > 0
}

function safeMouseClick(el: HTMLElement) {
  el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }))
  el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }))
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }))
}

function parseVisibleJobCards(url: string): VisibleJobCard[] {
  const wraps = Array.from(document.querySelectorAll('.job-card-wrap'))
  const items = wraps.length > 0 ? wraps : (Array.from(document.querySelectorAll('li')).filter((li) => li instanceof HTMLElement && li.querySelector('a') && li.getBoundingClientRect().width > 200) as HTMLElement[])

  const cards: VisibleJobCard[] = []

  for (const wrap of items) {
    if (!(wrap instanceof HTMLElement)) continue
    const titleAnchor = wrap.querySelector('a')
    if (!(titleAnchor instanceof HTMLAnchorElement)) continue

    const title = text(titleAnchor)
    if (!title || title.length < 2) continue

    const wrapText = text(wrap)
    const companyAnchor = wrap.querySelector('.job-card-footer a')
    const companyCandidate = companyAnchor ? text(companyAnchor) : ''
    if (!companyCandidate) continue

    if (!wrapText.includes('上海') && !/年|经验|本科|硕士|大专/.test(wrapText)) continue

    const lines = wrapText.split(' ').filter(Boolean)
    const experienceText = lines.find((line) => /经验|年/.test(line))
    const educationText = lines.find((line) => /本科|硕士|大专|博士/.test(line))
    const salaryText = lines.find((line) => /K/.test(line))
    const location = lines.find((line) => line.includes('上海'))
    const tags = lines.filter((line) => /(B端|C端|AI|Agent|工作流|风控|合规|中后台|内容产品|社区产品)/.test(line))

    cards.push({
      element: wrap,
      anchor: titleAnchor,
      snapshot: {
        id: `${companyCandidate}::${title}`,
        sourcePlatform: 'boss',
        sourceUrl: url,
        pageType: 'list',
        companyName: companyCandidate,
        jobTitle: title,
        location,
        salaryText,
        experienceText,
        educationText,
        tags,
        capturedAt: Date.now()
      }
    })
  }

  const seen = new Set<string>()
  return cards.filter((card) => {
    if (seen.has(card.snapshot.id)) return false
    seen.add(card.snapshot.id)
    return true
  })
}

function findDetailRoot(): HTMLElement | null {
  const clickableNodes = Array.from(document.querySelectorAll('a, button, div, span'))
  const cta = clickableNodes.find((node) => isVisible(node) && normalizeText(node.textContent) === '立即沟通')
  if (!(cta instanceof HTMLElement)) return null

  let current: HTMLElement | null = cta
  while (current) {
    const content = normalizeText(current.innerText)
    if (content.includes('职位描述') || content.length > 200) return current
    current = current.parentElement
  }
  return null
}

function enrichSnapshotFromDetail(card: VisibleJobCard): JobSnapshot {
  const root = findDetailRoot()
  const detailText = root ? normalizeText(root.innerText) : ''
  const tags = Array.from(new Set([...card.snapshot.tags, ...detailText.split(' ').filter((line) => /(B端|C端|AI|Agent|工作流|风控|合规|中后台|内容产品|社区产品)/.test(line))]))

  return {
    ...card.snapshot,
    pageType: 'detail',
    jdText: detailText,
    tags
  }
}

function hasRecentHistory(jobId: string, history: HistoryRecord[], dedupeDays: number): boolean {
  const threshold = Date.now() - dedupeDays * 24 * 60 * 60 * 1000
  return history.some((record) => record.jobId === jobId && record.timestamp >= threshold)
}

function makeQueueItem(snapshot: JobSnapshot, screening: ReturnType<typeof evaluateJob>['screening'], execution: ReturnType<typeof evaluateJob>['execution'], status: QueueItem['status'], lastError?: string): QueueItem {
  return {
    jobId: snapshot.id,
    snapshot,
    screening,
    execution,
    status,
    lastError,
    updatedAt: Date.now()
  }
}

function findTextAction(label: string): HTMLElement | null {
  const nodes = Array.from(document.querySelectorAll('a, button, div, span'))
  return (nodes.find((node) => isVisible(node) && normalizeText(node.textContent) === label) as HTMLElement | undefined) ?? null
}

async function sendFastFromDetail(snapshot: JobSnapshot): Promise<{ sent: boolean; error?: string }> {
  const root = findDetailRoot()
  const detailText = root ? normalizeText(root.innerText) : ''
  if (!detailText.includes(snapshot.jobTitle) && !detailText.includes(snapshot.companyName)) {
    return { sent: false, error: '详情页岗位信息与候选岗位不一致' }
  }

  const cta = findTextAction('立即沟通')
  if (!cta) {
    return { sent: false, error: '未找到立即沟通按钮' }
  }

  safeMouseClick(cta)
  await wait(800)

  const bodyText = normalizeText(document.body.innerText)
  const stayButton = findTextAction('留在此页')
  if (stayButton) {
    safeMouseClick(stayButton)
    await wait(300)
  }

  if (bodyText.includes('已向BOSS发送消息') || bodyText.includes('如需修改打招呼内容')) {
    return { sent: true }
  }

  return { sent: false, error: '未检测到发送成功提示' }
}

function findJobListScrollContainer(): HTMLElement | null {
  const firstWrap = document.querySelector('.job-card-wrap') as HTMLElement | null
  if (!firstWrap) return null

  let current: HTMLElement | null = firstWrap.parentElement
  while (current) {
    const canScroll = current.scrollHeight > current.clientHeight + 200
    const containsWraps = current.querySelector('.job-card-wrap')
    if (canScroll && containsWraps) {
      return current
    }
    current = current.parentElement
  }

  return null
}

async function scrollNextBatch(): Promise<boolean> {
  const target = findJobListScrollContainer()
  const before = target ? target.scrollTop : window.scrollY

  if (target) {
    target.scrollBy({ top: Math.max(target.clientHeight * 0.9, 500), behavior: 'auto' })
  } else {
    window.scrollBy({ top: Math.max(window.innerHeight * 0.9, 500), behavior: 'auto' })
  }

  await wait(1400)
  const after = target ? target.scrollTop : window.scrollY
  return after > before
}

export async function runBossBatchAutopilot(url: string, rules: ExtensionRules, history: HistoryRecord[]): Promise<{ summary: BatchRunSummary; historyAdds: HistoryRecord[] }> {
  const summary: BatchRunSummary = { sent: [], review: [], skipped: [] }
  const historyAdds: HistoryRecord[] = []
  const processed = new Set<string>()
  let rounds = 0
  let staleRounds = 0
  let totalHandled = 0

  emitProgress({
    phase: 'starting',
    sentCount: 0,
    reviewCount: 0,
    skippedCount: 0,
    rounds: 0,
    message: '开始读取当前页面岗位'
  })

  while (rounds < rules.batch.maxVisibleBatchesPerRun && totalHandled < rules.batch.maxJobsPerRun) {
    const cards = parseVisibleJobCards(url).filter((card) => !processed.has(card.snapshot.id))

    if (cards.length === 0) {
      emitProgress({
        phase: 'scrolling',
        sentCount: summary.sent.length,
        reviewCount: summary.review.length,
        skippedCount: summary.skipped.length,
        rounds,
        message: '当前屏无新岗位，尝试滚动下一屏'
      })
      const moved = await scrollNextBatch()
      if (!moved || staleRounds >= 1) break
      staleRounds += 1
      rounds += 1
      continue
    }

    staleRounds = 0

    for (const card of cards) {
      if (totalHandled >= rules.batch.maxJobsPerRun) break
      processed.add(card.snapshot.id)
      totalHandled += 1

      emitProgress({
        phase: 'processing',
        currentCompany: card.snapshot.companyName,
        currentJobTitle: card.snapshot.jobTitle,
        sentCount: summary.sent.length,
        reviewCount: summary.review.length,
        skippedCount: summary.skipped.length,
        rounds,
        message: `正在处理：${card.snapshot.companyName} / ${card.snapshot.jobTitle}`
      })

      if (hasRecentHistory(card.snapshot.id, history, rules.batch.dedupeDays)) {
        const { screening, execution } = evaluateJob(card.snapshot, rules)
        const skipped = makeQueueItem(card.snapshot, screening, { ...execution, nextAction: 'skip', canAutoSend: false, mode: 'analyze_only', blockers: ['7天内已处理，自动去重'] }, 'hard_rejected')
        skipped.screening.decisionReasons.unshift('7天内已处理，自动去重')
        summary.skipped.push(skipped)
        historyAdds.push({ jobId: card.snapshot.id, companyName: card.snapshot.companyName, jobTitle: card.snapshot.jobTitle, status: 'skipped', timestamp: Date.now() })
        continue
      }

      card.element.scrollIntoView({ block: 'center', behavior: 'auto' })
      safeMouseClick(card.anchor)
      await wait(700)

      const enriched = enrichSnapshotFromDetail(card)
      const { screening, execution } = evaluateJob(enriched, rules)

      if (execution.nextAction === 'skip') {
        summary.skipped.push(makeQueueItem(enriched, screening, execution, 'hard_rejected'))
        historyAdds.push({ jobId: enriched.id, companyName: enriched.companyName, jobTitle: enriched.jobTitle, status: 'skipped', timestamp: Date.now() })
        continue
      }

      if (execution.nextAction === 'review') {
        summary.review.push(makeQueueItem(enriched, screening, execution, 'needs_review'))
        historyAdds.push({ jobId: enriched.id, companyName: enriched.companyName, jobTitle: enriched.jobTitle, status: 'review', timestamp: Date.now() })
        continue
      }

      const sentResult = await sendFastFromDetail(enriched)
      if (sentResult.sent) {
        summary.sent.push(makeQueueItem(enriched, screening, execution, 'sent'))
        historyAdds.push({ jobId: enriched.id, companyName: enriched.companyName, jobTitle: enriched.jobTitle, status: 'sent', timestamp: Date.now() })
      } else {
        summary.review.push(makeQueueItem(enriched, screening, { ...execution, canAutoSend: false, nextAction: 'review', mode: 'send_after_confirm', blockers: [sentResult.error ?? '发送失败'] }, 'blocked', sentResult.error))
        historyAdds.push({ jobId: enriched.id, companyName: enriched.companyName, jobTitle: enriched.jobTitle, status: 'review', timestamp: Date.now() })
      }
    }

    rounds += 1
    if (totalHandled >= rules.batch.maxJobsPerRun) break
    const moved = await scrollNextBatch()
    if (!moved) break
  }

  emitProgress({
    phase: 'finished',
    sentCount: summary.sent.length,
    reviewCount: summary.review.length,
    skippedCount: summary.skipped.length,
    rounds,
    message: '本轮处理完成'
  })

  return { summary, historyAdds }
}
