import { detectBossPageType } from '../platforms/boss/detectPageType'
import { parseBossListPage } from '../platforms/boss/parseListPage'
import { runBossBatchAutopilot } from '../platforms/boss/runBatchAutopilot'

function boot() {
  const pageType = detectBossPageType(location.href)
  document.documentElement.setAttribute('data-boss-job-apply-page-type', pageType)
  console.log('[boss-job-apply-extension] page type:', pageType)
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'PING') {
    sendResponse({ ok: true })
    return false
  }

  if (message?.type === 'EXTRACT_CURRENT_PAGE') {
    const pageType = detectBossPageType(location.href)

    if (pageType === 'list') {
      const jobs = parseBossListPage(document, location.href)
      sendResponse({ pageType, jobs })
      return true
    }

    sendResponse({ pageType, jobs: [] })
    return true
  }

  if (message?.type === 'DIAGNOSE_PAGE') {
    const wraps = document.querySelectorAll('.job-card-wrap')
    const boxen = document.querySelectorAll('.job-card-box')
    const allJobMatches = document.querySelectorAll('[class*="job"][class*="card"]')
    const firstWrap = wraps[0]
    const report = {
      wrapsCount: wraps.length,
      boxCount: boxen.length,
      jobCardClassCount: allJobMatches.length,
      firstWrapHTML: firstWrap ? firstWrap.outerHTML.slice(0, 200) : null,
      firstWrapClass: firstWrap ? firstWrap.className : null,
      firstWrapTag: firstWrap ? firstWrap.tagName : null,
      firstWrapFooter: firstWrap ? firstWrap.querySelector('.job-card-footer a')?.textContent?.trim()?.slice(0, 50) : null,
      firstWrapTitle: firstWrap ? firstWrap.querySelector('a')?.textContent?.trim()?.slice(0, 50) : null
    }
    sendResponse(report)
    return false
  }

  if (message?.type === 'RUN_BATCH_AUTOPILOT') {
    const payload = message.payload as { url: string; rules: any; history: any[] }
    runBossBatchAutopilot(payload.url, payload.rules, payload.history ?? []).then((result) => {
      sendResponse(result)
    })
    return true
  }
})

boot()
