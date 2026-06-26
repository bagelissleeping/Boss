import type { JobSnapshot } from '../../types'

function text(el: Element | null | undefined): string {
  return el?.textContent?.replace(/\s+/g, ' ').trim() ?? ''
}

function extractCards(doc: Document): HTMLElement[] {
  const wraps = Array.from(doc.querySelectorAll('.job-card-wrap'))
  if (wraps.length > 0) return wraps as HTMLElement[]
  const byLi = Array.from(doc.querySelectorAll('li'))
  return byLi.filter((li) => li instanceof HTMLElement && li.querySelector('a') && li.getBoundingClientRect().width > 200) as HTMLElement[]
}

export function parseBossListPage(documentRef: Document, url: string): JobSnapshot[] {
  const items = extractCards(documentRef)
  const jobs: JobSnapshot[] = []

  for (const item of items) {
    const itemText = text(item)
    const titleAnchor = item.querySelector('a')
    const title = text(titleAnchor)
    if (!title || title.length < 2) continue

    const companyAnchor = item.querySelector('.job-card-footer a')
    const companyCandidate = companyAnchor ? text(companyAnchor) : ''

    if (!companyCandidate) continue
    if (!itemText.includes('上海') && !/年|经验|本科|硕士/.test(itemText)) continue

    const lines = itemText.split(/\s+/).filter(Boolean)
    const experienceText = lines.find((line) => /经验|年/.test(line))
    const educationText = lines.find((line) => /本科|硕士|大专|博士/.test(line))
    const salaryText = lines.find((line) => /K/.test(line))
    const location = lines.find((line) => line.includes('上海'))
    const tags = lines.filter((line) => /(B端|C端|AI|Agent|工作流|风控|合规|中后台|内容产品|社区产品)/.test(line))

    jobs.push({
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
    })
  }

  const seen = new Set<string>()
  return jobs.filter((job) => {
    if (seen.has(job.id)) return false
    seen.add(job.id)
    return true
  })
}
