<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import type { BatchRunSummary } from '../../types'
import { countTodaySent, loadHistory } from '../../store/historyStore'

interface ProgressState {
  phase: 'starting' | 'processing' | 'scrolling' | 'finished'
  currentCompany?: string
  currentJobTitle?: string
  sentCount: number
  reviewCount: number
  skippedCount: number
  rounds: number
  message: string
}

const pageType = ref('unknown')
const pageUrl = ref('')
const pageReady = ref(false)
const loading = ref(false)
const errorMessage = ref('')
const diagnostic = ref<any>(null)
const todaySentTotal = ref(0)
const summary = ref<BatchRunSummary>({ sent: [], review: [], skipped: [] })
const progress = ref<ProgressState | null>(null)

const sentCount = computed(() => progress.value?.sentCount ?? summary.value.sent.length)
const reviewCount = computed(() => progress.value?.reviewCount ?? summary.value.review.length)
const skippedCount = computed(() => progress.value?.skippedCount ?? summary.value.skipped.length)
const canRun = computed(() => pageReady.value && pageType.value === 'list')
const hasResults = computed(() => summary.value.sent.length > 0 || summary.value.review.length > 0 || summary.value.skipped.length > 0)
const resultGroups = computed(() => [
  {
    key: 'sent',
    label: '本轮已发送',
    tone: 'sent',
    items: summary.value.sent
  },
  {
    key: 'review',
    label: '待复核',
    tone: 'review',
    items: summary.value.review
  },
  {
    key: 'skipped',
    label: '已跳过',
    tone: 'skipped',
    items: summary.value.skipped
  }
])

function handleRuntimeMessage(message: { type?: string; progress?: ProgressState }) {
  if (message?.type === 'BATCH_PROGRESS' && message.progress) {
    progress.value = message.progress
    if (message.progress.phase === 'finished') {
      loading.value = false
      loadTodaySentTotal()
    }
  }
}

async function loadContext() {
  const result = await chrome.runtime.sendMessage({ type: 'GET_PAGE_CONTEXT' })
  pageType.value = result?.pageType ?? 'unknown'
  pageUrl.value = result?.url ?? ''
  pageReady.value = Boolean(result?.ready)
}

async function loadTodaySentTotal() {
  const history = await loadHistory()
  todaySentTotal.value = countTodaySent(history)
}

async function runDiagnose() {
  errorMessage.value = ''
  diagnostic.value = null
  try {
    const result = await chrome.runtime.sendMessage({ type: 'DIAGNOSE_PAGE' })
    diagnostic.value = result
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '诊断失败'
  }
}

async function runBatchAutopilot() {
  loading.value = true
  errorMessage.value = ''
  progress.value = {
    phase: 'starting',
    sentCount: 0,
    reviewCount: 0,
    skippedCount: 0,
    rounds: 0,
    message: '已发起批量任务'
  }

  try {
    const result = await chrome.runtime.sendMessage({ type: 'RUN_BATCH_AUTOPILOT' })
    if (result?.error) {
      errorMessage.value = result.error
      return
    }
    if (result?.summary) {
      summary.value = result.summary
    }
    await loadTodaySentTotal()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '运行失败，请刷新页面后重试'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  chrome.runtime.onMessage.addListener(handleRuntimeMessage)
  loadContext()
  loadTodaySentTotal()
})

onUnmounted(() => {
  chrome.runtime.onMessage.removeListener(handleRuntimeMessage)
})
</script>

<template>
  <main class="panel">
    <header class="hero">
      <div>
        <p class="eyebrow">BOSS 求职助手</p>
        <h1>岗位筛选侧边栏</h1>
      </div>
      <div class="hero-score">
        <span>今日投递</span>
        <strong>{{ todaySentTotal }}</strong>
      </div>
    </header>

    <section class="panel-card">
      <div class="section-head">
        <h2>当前页面</h2>
        <span class="pill" :class="pageReady ? 'pill-ok' : 'pill-muted'">{{ pageReady ? '已连接' : '未连接' }}</span>
      </div>
      <dl class="status-grid">
        <div>
          <dt>页面类型</dt>
          <dd>{{ pageType }}</dd>
        </div>
        <div>
          <dt>连接状态</dt>
          <dd>{{ pageReady ? '已连接' : '未连接' }}</dd>
        </div>
      </dl>
      <p v-if="pageUrl" class="url">{{ pageUrl }}</p>
      <p v-if="pageType !== 'list'" class="inline-note">仅列表页可执行。</p>
    </section>

    <section class="panel-card">
      <div class="section-head">
        <h2>今日操作</h2>
        <span v-if="loading" class="pill pill-running">运行中</span>
      </div>
      <div class="actions">
        <button class="button-primary" @click="runBatchAutopilot" :disabled="loading || !canRun">
          {{ loading ? '运行中' : '开始筛选与投递' }}
        </button>
        <button @click="loadContext">刷新状态</button>
        <button @click="runDiagnose">诊断页面</button>
      </div>
      <div class="feedback" v-if="diagnostic || errorMessage || progress">
        <div v-if="diagnostic" class="diagnostic">
          <pre>{{ JSON.stringify(diagnostic, null, 2) }}</pre>
        </div>
        <div v-if="errorMessage" class="alert">{{ errorMessage }}</div>
        <div v-if="progress" class="progress">
          <div class="progress-line">
            <span class="progress-label">{{ progress.phase }}</span>
            <span>{{ progress.message }}</span>
          </div>
          <div class="progress-meta">
            <span v-if="progress.currentCompany || progress.currentJobTitle">当前岗位：{{ progress.currentCompany }} / {{ progress.currentJobTitle }}</span>
            <span>轮次：{{ progress.rounds }}</span>
            <span>已发出：{{ progress.sentCount }}</span>
            <span>待复核：{{ progress.reviewCount }}</span>
            <span>已跳过：{{ progress.skippedCount }}</span>
          </div>
        </div>
      </div>
    </section>

    <section class="metrics">
      <article class="metric sent">
        <h3>本轮已发送</h3>
        <strong>{{ sentCount }}</strong>
      </article>
      <article class="metric review">
        <h3>待复核</h3>
        <strong>{{ reviewCount }}</strong>
      </article>
      <article class="metric skipped">
        <h3>已跳过</h3>
        <strong>{{ skippedCount }}</strong>
      </article>
    </section>

    <section v-if="hasResults" class="panel-card results">
      <template v-for="group in resultGroups" :key="group.key">
        <article v-if="group.items.length" class="result-block" :class="`tone-${group.tone}`">
          <div class="result-head">
            <h3>{{ group.label }}</h3>
            <span class="count-chip">{{ group.items.length }}</span>
          </div>
          <ul class="result-list">
            <li v-for="item in group.items" :key="item.jobId" class="result-item">
              <div class="result-main">
                <strong>{{ item.snapshot.companyName }}</strong>
                <span>{{ item.snapshot.jobTitle }}</span>
              </div>
              <p v-if="group.key !== 'sent'" class="result-reason">{{ item.screening.decisionReasons.join('；') }}</p>
            </li>
          </ul>
        </article>
      </template>
    </section>

    <section v-else-if="!loading" class="panel-card empty">
      <h2>暂无结果</h2>
    </section>
  </main>
</template>
