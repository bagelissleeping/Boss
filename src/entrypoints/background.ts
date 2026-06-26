import { detectBossPageType } from '../platforms/boss/detectPageType'
import { loadSettings } from '../store/settingsStore'
import { appendHistory, loadHistory } from '../store/historyStore'
import { saveBatchSummary } from '../store/jobQueueStore'

chrome.runtime.onInstalled.addListener(() => {
  console.log('[boss-job-apply-extension] installed')
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {
    console.warn('[boss-job-apply-extension] failed to enable openPanelOnActionClick')
  })
})

chrome.runtime.onStartup?.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {
    console.warn('[boss-job-apply-extension] failed to restore side panel behavior on startup')
  })
})

async function getBossTab() {
  const tabs = await chrome.tabs.query({ currentWindow: true })
  const activeTab = tabs.find((tab) => tab.active)
  const activeIsBoss = activeTab?.url?.startsWith('https://www.zhipin.com/')
  if (activeIsBoss) return activeTab

  const bossTabs = tabs.filter((tab) => (tab.url ?? '').startsWith('https://www.zhipin.com/'))
  if (bossTabs.length > 0) return bossTabs[0]
  return activeTab
}

async function isContentScriptReady(tabId: number) {
  try {
    const response = await chrome.tabs.sendMessage(tabId, { type: 'PING' })
    return Boolean(response?.ok)
  } catch {
    return false
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'GET_PAGE_CONTEXT') {
    getBossTab().then(async (tab) => {
      const url = tab?.url ?? ''
      const pageType = detectBossPageType(url)
      const ready = tab?.id ? await isContentScriptReady(tab.id) : false
      sendResponse({ pageType, url, ready })
    })
    return true
  }

  if (message?.type === 'DIAGNOSE_PAGE') {
    getBossTab().then(async (tab) => {
      try {
        if (!tab?.id || !tab.url) {
          sendResponse({ error: '未找到当前标签页' })
          return
        }

        if (!tab.url.startsWith('https://www.zhipin.com/')) {
          sendResponse({ error: '当前窗口没有可用的 BOSS 页面，请先切到 BOSS 列表页' })
          return
        }

        const ready = await isContentScriptReady(tab.id)
        if (!ready) {
          sendResponse({ error: '当前 BOSS 页面尚未连接扩展，请先刷新该 BOSS 页面后重试' })
          return
        }

        const result = await chrome.tabs.sendMessage(tab.id, { type: 'DIAGNOSE_PAGE' })
        sendResponse(result)
      } catch (error) {
        const messageText = error instanceof Error ? error.message : '诊断失败'
        sendResponse({ error: messageText })
      }
    })
    return true
  }

  if (message?.type === 'RUN_BATCH_AUTOPILOT') {
    getBossTab().then(async (tab) => {
      try {
        if (!tab?.id || !tab.url) {
          sendResponse({ error: '未找到当前标签页' })
          return
        }

        if (!tab.url.startsWith('https://www.zhipin.com/')) {
          sendResponse({ error: '当前窗口没有可用的 BOSS 页面，请先切到 BOSS 列表页' })
          return
        }

        const ready = await isContentScriptReady(tab.id)
        if (!ready) {
          sendResponse({ error: '当前 BOSS 页面尚未连接扩展，请先刷新该 BOSS 页面后重试' })
          return
        }

        const settings = await loadSettings()
        const history = await loadHistory()
        const result = await chrome.tabs.sendMessage(tab.id, {
          type: 'RUN_BATCH_AUTOPILOT',
          payload: {
            url: tab.url,
            rules: settings,
            history
          }
        })

        if (result?.summary) {
          await saveBatchSummary(result.summary)
        }
        if (result?.historyAdds?.length) {
          await appendHistory(result.historyAdds)
        }

        sendResponse(result)
      } catch (error) {
        const messageText = error instanceof Error ? error.message : '批量任务执行失败'
        sendResponse({ error: messageText })
      }
    })
    return true
  }

  if (message?.type === 'BATCH_PROGRESS') {
    return false
  }

  if (message?.type === 'OPEN_SIDEPANEL') {
    chrome.sidePanel.open({ windowId: message.windowId })
  }
})
