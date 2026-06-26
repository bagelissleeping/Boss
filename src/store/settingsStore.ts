import type { ExtensionRules } from '../core/rules/defaultRules'
import { defaultRules } from '../core/rules/defaultRules'

const SETTINGS_KEY = 'boss-job-apply:settings'

function mergeStringArray(base: string[], saved?: string[]) {
  return Array.from(new Set([...(base ?? []), ...(saved ?? [])]))
}

function mergeSettings(saved?: Partial<ExtensionRules> | null): ExtensionRules {
  return {
    ...defaultRules,
    ...saved,
    hardExperiencePatterns: mergeStringArray(defaultRules.hardExperiencePatterns, saved?.hardExperiencePatterns),
    blockedCompanies: mergeStringArray(defaultRules.blockedCompanies, saved?.blockedCompanies),
    trustedCompanies: mergeStringArray(defaultRules.trustedCompanies, saved?.trustedCompanies),
    outsourcingCompanies: mergeStringArray(defaultRules.outsourcingCompanies, saved?.outsourcingCompanies),
    trustedIndustryKeywords: mergeStringArray(defaultRules.trustedIndustryKeywords, saved?.trustedIndustryKeywords),
    headhunterSignals: mergeStringArray(defaultRules.headhunterSignals, saved?.headhunterSignals),
    outsourcingStrongSignals: mergeStringArray(defaultRules.outsourcingStrongSignals, saved?.outsourcingStrongSignals),
    outsourcingMediumSignals: mergeStringArray(defaultRules.outsourcingMediumSignals, saved?.outsourcingMediumSignals),
    targetKeywords: mergeStringArray(defaultRules.targetKeywords, saved?.targetKeywords),
    rejectKeywords: mergeStringArray(defaultRules.rejectKeywords, saved?.rejectKeywords),
    greetingTemplates: {
      ...defaultRules.greetingTemplates,
      ...(saved?.greetingTemplates ?? {})
    },
    batch: {
      ...defaultRules.batch,
      ...(saved?.batch ?? {})
    }
  }
}

export async function loadSettings(): Promise<ExtensionRules> {
  const result = await chrome.storage.local.get(SETTINGS_KEY)
  return mergeSettings(result[SETTINGS_KEY] ?? null)
}

export async function saveSettings(settings: ExtensionRules) {
  await chrome.storage.local.set({ [SETTINGS_KEY]: mergeSettings(settings) })
}
