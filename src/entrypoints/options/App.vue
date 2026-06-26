<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { loadSettings, saveSettings } from '../../store/settingsStore'

const hardPatterns = ref('')
const targetKeywords = ref('')
const saved = ref(false)

onMounted(async () => {
  const settings = await loadSettings()
  hardPatterns.value = settings.hardExperiencePatterns.join('\n')
  targetKeywords.value = settings.targetKeywords.join('\n')
})

async function handleSave() {
  const settings = await loadSettings()
  await saveSettings({
    ...settings,
    hardExperiencePatterns: hardPatterns.value.split('\n').map((item) => item.trim()).filter(Boolean),
    targetKeywords: targetKeywords.value.split('\n').map((item) => item.trim()).filter(Boolean)
  })
  saved.value = true
  setTimeout(() => {
    saved.value = false
  }, 1500)
}
</script>

<template>
  <main class="settings">
    <header class="topbar">
      <div>
        <p class="eyebrow">BOSS 求职助手</p>
        <h1>规则中心</h1>
      </div>
      <button class="button-primary" @click="handleSave">{{ saved ? '已保存' : '保存设置' }}</button>
    </header>

    <section class="settings-grid">
      <article class="setting-card">
        <div class="section-head">
          <h2>年限硬筛</h2>
          <span class="tag">规则</span>
        </div>
        <textarea v-model="hardPatterns" rows="5" spellcheck="false"></textarea>
      </article>

      <article class="setting-card">
        <div class="section-head">
          <h2>目标关键词</h2>
          <span class="tag">关键词</span>
        </div>
        <textarea v-model="targetKeywords" rows="10" spellcheck="false"></textarea>
      </article>
    </section>
  </main>
</template>
