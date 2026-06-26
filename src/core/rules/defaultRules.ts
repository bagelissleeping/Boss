export interface ExtensionRules {
  hardExperiencePatterns: string[]
  blockedCompanies: string[]
  trustedCompanies: string[]
  outsourcingCompanies: string[]
  trustedIndustryKeywords: string[]
  headhunterSignals: string[]
  outsourcingStrongSignals: string[]
  outsourcingMediumSignals: string[]
  targetKeywords: string[]
  rejectKeywords: string[]
  greetingTemplates: {
    fastDefault: string
    agentFocused: string
  }
  batch: {
    dedupeDays: number
    autoScrollEnabled: boolean
    maxVisibleBatchesPerRun: number
    maxJobsPerRun: number
  }
}

export const defaultRules: ExtensionRules = {
  hardExperiencePatterns: ['5-10年'],
  blockedCompanies: ['示例黑名单公司'],
  trustedCompanies: ['示例目标公司'],
  outsourcingCompanies: ['示例外包公司'],
  trustedIndustryKeywords: ['互联网', '金融科技', '企业服务', '电商平台'],
  headhunterSignals: ['猎头', '顾问', '代招'],
  outsourcingStrongSignals: ['驻场', '外派', 'OD', '项目外包', '派驻客户现场', '代招'],
  outsourcingMediumSignals: ['客户项目支持', '交付能力', '解决方案', '客户案例'],
  targetKeywords: ['ToB', 'B端产品', 'Agent', '智能体', '工作流', 'RAG', '知识库', '审查', '合规', '风控', '企业服务', '中后台', 'AI产品', '大模型'],
  rejectKeywords: ['社区产品', '内容产品', '用户增长', '纯销售', '纯运营'],
  greetingTemplates: {
    fastDefault: '您好，我对该岗位很感兴趣，过往经历与岗位方向较匹配，如方便可进一步沟通，谢谢。',
    agentFocused: '您好，我有 AI 产品、Agent/Workflow 或企业服务相关经验，和该岗位方向比较相关，想进一步沟通。'
  },
  batch: {
    dedupeDays: 7,
    autoScrollEnabled: true,
    maxVisibleBatchesPerRun: 8,
    maxJobsPerRun: 20
  }
}
