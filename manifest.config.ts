import type { ManifestV3Export } from '@crxjs/vite-plugin'

const manifest: ManifestV3Export = {
  manifest_version: 3,
  name: 'BOSS 求职助手',
  version: '0.1.0',
  description: '用于 BOSS 直聘岗位筛选、复核与批量投递的侧边栏插件。',
  permissions: ['storage', 'tabs', 'scripting', 'activeTab', 'sidePanel'],
  host_permissions: ['https://www.zhipin.com/*'],
  background: {
    service_worker: 'src/entrypoints/background.ts',
    type: 'module'
  },
  content_scripts: [
    {
      matches: ['https://www.zhipin.com/*'],
      js: ['src/entrypoints/content.ts'],
      run_at: 'document_idle'
    }
  ],
  side_panel: {
    default_path: 'src/entrypoints/sidepanel/index.html'
  },
  options_page: 'src/entrypoints/options/index.html',
  action: {
    default_title: 'BOSS 求职助手'
  }
}

export default manifest
