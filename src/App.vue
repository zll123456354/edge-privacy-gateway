<script setup lang="ts">
import { ref, computed } from 'vue'

const mode = ref<'edge'|'cloud'>('edge')
const side = ref<'face'|'back'>('face')
const file = ref<File|null>(null)
const base64 = ref('')
const loading = ref(false)
const status = ref<any>(null)
const result = ref<any>(null)
const error = ref('')

const maskedView = computed(() => {
  if (!result.value) return []
  const m = result.value.masked || {}
  return [
    { k: '姓名', v: m.name || '' },
    { k: '性别', v: m.sex || '' },
    { k: '民族', v: m.nationality || '' },
    { k: '出生日期', v: m.birth || '' },
    { k: '地址', v: m.address || '' },
    { k: '身份证号', v: m.id || '' },
  ]
})

const pickFile = (e: Event) => {
  const input = e.target as HTMLInputElement
  const f = input.files?.[0] || null
  file.value = f
  if (!f) return
  const rd = new FileReader()
  rd.onload = () => { base64.value = String(rd.result || '') }
  rd.readAsDataURL(f)
}

const start = async () => {
  error.value = ''
  status.value = null
  result.value = null
  const img = base64.value
  if (!img) { error.value = '请上传图片或粘贴 Base64'; return }
  loading.value = true
  try {
    const res = await fetch('/api/ocr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Mode': mode.value },
      body: JSON.stringify({ image: img, side: side.value })
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data?.error || '请求失败')
    status.value = data.status
    result.value = { masked: data.masked, original: data.original }
  } catch (e: any) {
    error.value = String(e?.message || e)
  } finally {
    loading.value = false
  }
}

const copyJson = async () => {
  if (!result.value) return
  const payload = JSON.stringify(result.value, null, 2)
  try { await navigator.clipboard.writeText(payload) } catch {}
}

const downloadJson = () => {
  if (!result.value) return
  const blob = new Blob([JSON.stringify(result.value, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'edge-privacy-result.json'
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <div class="container">
    <div class="header">
      <h1>Edge Privacy Gateway</h1>
      <p class="subtitle">在数据产生第一跳完成隐私保护</p>
      <div class="modes">
        <button :class="['pill', mode==='edge'?'on':'']" @click="mode='edge'">Edge Privacy Mode ON</button>
        <button :class="['pill', mode==='cloud'?'on':'']" @click="mode='cloud'">Cloud Mode</button>
      </div>
      <p v-if="mode==='cloud'" class="warn">⚠ Cloud Mode：数据可能上传至中心云，仅用于对比展示</p>
    </div>

    <div class="section">
      <h2>① 数据输入区</h2>
      <div class="card">
        <div class="row">
          <input type="file" accept="image/*" @change="pickFile" />
          <span class="or">或</span>
          <textarea v-model="base64" placeholder="粘贴 Base64" rows="4"></textarea>
        </div>
        <div class="row">
          <label><input type="radio" value="face" v-model="side" /> 正面</label>
          <label><input type="radio" value="back" v-model="side" /> 反面</label>
        </div>
      </div>
      <button class="primary" @click="start" :disabled="loading">开始 Edge 处理</button>
    </div>

    <div class="section">
      <h2>② Edge 执行状态</h2>
      <div class="card" v-if="status">
        <div class="status-item"><span class="dot green"></span>执行位置：{{ status.location }}</div>
        <div class="status-item"><span class="dot green"></span>原始数据是否出云：{{ status.rawDataLeftCloud ? '是' : '否' }}</div>
        <div class="status-item"><span class="dot green"></span>OCR & 脱敏执行：边缘完成</div>
        <div class="status-item"><span class="dot green"></span>执行耗时：{{ status.elapsedMs }} ms</div>
        <div class="status-item"><span class="dot green"></span>隐私字段识别：{{ (status.fieldsDetected||[]).join(' / ') }}</div>
      </div>
    </div>

    <div class="section">
      <h2>③ 识别 & 脱敏结果</h2>
      <div class="card" v-if="result">
        <div v-for="item in maskedView" :key="item.k" class="kv"><span>{{ item.k }}：</span><span>{{ item.v }}</span></div>
      </div>
      <div class="actions" v-if="result">
        <button @click="copyJson">复制 JSON</button>
        <button @click="downloadJson">下载结果</button>
      </div>
      <div v-if="error" class="error">{{ error }}</div>
    </div>

    <div class="section">
      <h2>④ Edge Gateway 接口说明</h2>
      <div class="card code">
        <div>POST /api/ocr</div>
        <pre>{
  "image": "base64...",
  "side": "face"
}</pre>
        <div>→ 返回：已脱敏的结构化结果</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.container { max-width: 980px; margin: 0 auto; padding: 32px 24px; font-family: -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,"Microsoft YaHei"; color: #2c3e50; }
.header { text-align: center; margin-bottom: 24px; }
.header h1 { margin: 0; font-size: 32px; font-weight: 700; }
.subtitle { color: #637381; margin-top: 6px; }
.modes { margin-top: 14px; display: flex; gap: 10px; justify-content: center; }
.pill { padding: 8px 14px; border-radius: 999px; border: 1px solid #d0d7de; background: #fff; cursor: pointer; box-shadow: 0 1px 2px rgba(0,0,0,0.04); }
.pill.on { background: #2ecc71; color: #fff; border-color: #2ecc71; }
.warn { color: #d35400; font-size: 12px; margin-top: 8px; }
.section { margin-top: 24px; }
.card { border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; background: #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
.row { display: flex; align-items: center; gap: 12px; }
textarea { flex: 1; width: 100%; border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px; }
.or { color: #8898aa; }
.primary { margin-top: 12px; padding: 10px 14px; background: #409eff; color: #fff; border: none; border-radius: 8px; cursor: pointer; box-shadow: 0 2px 6px rgba(64,158,255,0.3); }
.status-item { display: flex; align-items: center; gap: 8px; margin: 6px 0; }
.dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; }
.dot.green { background: #2ecc71; }
.kv { display: flex; gap: 6px; padding: 6px 0; }
.actions { display: flex; gap: 10px; margin-top: 10px; }
.error { color: #c0392b; margin-top: 8px; }
.code { background: #fafafa; }
pre { background: #f0f2f5; padding: 10px; border-radius: 8px; overflow: auto; border: 1px solid #e5e7eb; }
</style>
