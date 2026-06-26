export type RiskLevel = 'low' | 'medium' | 'high'
export type Decision = 'recommend' | 'review' | 'reject'
export type ExecutionMode = 'analyze_only' | 'fill_only' | 'auto_send_safe' | 'send_after_confirm'
export type PageType = 'list' | 'detail' | 'chat' | 'unknown'
export type QueueStatus = 'discovered' | 'parsed' | 'hard_rejected' | 'needs_review' | 'safe_to_send' | 'filled_not_sent' | 'sent' | 'blocked' | 'error'

export interface JobSnapshot {
  id: string
  sourcePlatform: 'boss'
  sourceUrl: string
  pageType: PageType
  companyName: string
  jobTitle: string
  location?: string
  salaryText?: string
  experienceText?: string
  educationText?: string
  jdText?: string
  tags: string[]
  capturedAt: number
}

export interface ScreeningResult {
  hardFilterHit: boolean
  hardFilterReasons: string[]
  matchScoreBand: 'high' | 'medium' | 'low'
  riskLevel: RiskLevel
  riskSignals: string[]
  needsBackgroundCheck: boolean
  decision: Decision
  decisionReasons: string[]
}

export interface ExecutionPlan {
  mode: ExecutionMode
  canAutoSend: boolean
  blockers: string[]
  nextAction: 'skip' | 'review' | 'fill' | 'send'
  requiresExplicitConfirmation: boolean
}

export interface GreetingDraft {
  templateId: string
  messageText: string
  editedByUser: boolean
  validated: boolean
}

export interface QueueItem {
  jobId: string
  snapshot: JobSnapshot
  screening: ScreeningResult
  execution: ExecutionPlan
  greeting?: GreetingDraft
  status: QueueStatus
  lastError?: string
  updatedAt: number
}

export interface BatchRunSummary {
  sent: QueueItem[]
  review: QueueItem[]
  skipped: QueueItem[]
}

export interface HistoryRecord {
  jobId: string
  companyName: string
  jobTitle: string
  status: 'sent' | 'review' | 'skipped'
  timestamp: number
}
