import type { ExtensionRules } from './defaultRules'
import type { ExecutionPlan, JobSnapshot, ScreeningResult } from '../../types'
import { defaultRules } from './defaultRules'

export function evaluateJob(
  snapshot: JobSnapshot,
  rules: ExtensionRules = defaultRules
): { screening: ScreeningResult; execution: ExecutionPlan } {
  const haystack = [snapshot.jobTitle, snapshot.companyName, snapshot.experienceText, snapshot.jdText, ...snapshot.tags]
    .filter(Boolean)
    .join(' | ')

  const hardFilterReasons: string[] = []
  if (rules.hardExperiencePatterns.some((pattern) => haystack.includes(pattern))) {
    hardFilterReasons.push('命中工作年限硬筛')
  }
  if (rules.blockedCompanies.some((name) => snapshot.companyName.includes(name))) {
    hardFilterReasons.push('命中公司黑名单')
  }

  const isTrustedCompany = rules.trustedCompanies.some((name) => snapshot.companyName.includes(name))
  const isOutsourcingCompany = rules.outsourcingCompanies.some((name) => snapshot.companyName.includes(name))
  const looksGenericCompany = /某|知名|大型|互联网公司/.test(snapshot.companyName)
  const hasHeadhunterSignal = rules.headhunterSignals.some((signal) => haystack.includes(signal))
  const hasTrustedIndustrySignal = !looksGenericCompany && rules.trustedIndustryKeywords.some((signal) => haystack.includes(signal))

  const riskSignals = rules.outsourcingStrongSignals.filter((signal) => haystack.includes(signal))
  const mediumSignals = rules.outsourcingMediumSignals.filter((signal) => haystack.includes(signal))
  const matchedTarget = rules.targetKeywords.filter((signal) => haystack.includes(signal))
  const matchedReject = rules.rejectKeywords.filter((signal) => haystack.includes(signal))

  let decision: ScreeningResult['decision'] = 'review'
  let matchScoreBand: ScreeningResult['matchScoreBand'] = 'medium'
  let riskLevel: ScreeningResult['riskLevel'] = 'low'
  const decisionReasons: string[] = []

  if (hardFilterReasons.length > 0) {
    decision = 'reject'
    matchScoreBand = 'low'
    decisionReasons.push(...hardFilterReasons)
  } else if (isOutsourcingCompany) {
    decision = 'reject'
    riskLevel = 'high'
    matchScoreBand = 'low'
    decisionReasons.push('命中外包公司名单，直接跳过')
  } else {
    if (riskSignals.length > 0) {
      riskLevel = 'high'
      decision = 'reject'
      decisionReasons.push('JD 命中强外包/派遣信号，直接跳过')
    } else if (mediumSignals.length > 0) {
      if (isTrustedCompany || hasTrustedIndustrySignal) {
        decisionReasons.push('公司名/行业优先判定为非外包，不因弱交付词跳过')
      } else if ((looksGenericCompany || hasHeadhunterSignal) && mediumSignals.length > 0) {
        riskLevel = 'medium'
        decision = 'reject'
        decisionReasons.push('公司隐藏或猎头发布，且 JD 命中疑似外包/交付信号，直接跳过')
      } else if (!looksGenericCompany && matchedTarget.length > 0) {
        decisionReasons.push('公司主体清晰且岗位方向匹配，弱交付词不直接判外包')
      } else {
        riskLevel = 'medium'
        decision = 'reject'
        decisionReasons.push('疑似外包/交付导向，直接跳过')
      }
    }

    if (matchedReject.length > 0 && matchedTarget.length === 0) {
      decision = 'reject'
      matchScoreBand = 'low'
      decisionReasons.push('岗位方向偏离当前目标')
    } else if (matchedTarget.length >= 2 && riskLevel === 'low') {
      decision = 'recommend'
      matchScoreBand = 'high'
      decisionReasons.push('命中多个目标岗位关键词')
    } else if (matchedTarget.length > 0 && riskLevel === 'low') {
      decision = 'recommend'
      matchScoreBand = 'medium'
      decisionReasons.push('部分命中目标岗位关键词，可直接投递')
    } else if (decision !== 'reject') {
      decision = 'review'
      decisionReasons.push('岗位与目标方向匹配度一般')
    }
  }

  const screening: ScreeningResult = {
    hardFilterHit: hardFilterReasons.length > 0,
    hardFilterReasons,
    matchScoreBand,
    riskLevel,
    riskSignals: [...riskSignals, ...mediumSignals],
    needsBackgroundCheck: riskLevel !== 'low',
    decision,
    decisionReasons
  }

  const execution: ExecutionPlan =
    decision === 'recommend' && riskLevel === 'low'
      ? {
          mode: 'auto_send_safe',
          canAutoSend: true,
          blockers: [],
          nextAction: 'send',
          requiresExplicitConfirmation: false
        }
      : decision === 'review'
        ? {
            mode: 'send_after_confirm',
            canAutoSend: false,
            blockers: ['需要复核后再决定是否投递'],
            nextAction: 'review',
            requiresExplicitConfirmation: true
          }
        : {
            mode: 'analyze_only',
            canAutoSend: false,
            blockers: ['不推荐投递'],
            nextAction: 'skip',
            requiresExplicitConfirmation: false
          }

  return { screening, execution }
}
