<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { exportReport, fetchReportSummary } from '../api';
import { useStudyStore } from '../stores/study';
import type { ReportSummary } from '../types';

const store = useStudyStore();
const period = ref<'weekly' | 'monthly'>('weekly');
const summary = ref<ReportSummary | null>(null);
const loading = ref(false);

const loadSummary = async () => {
  if (!store.selectedStudentId) {
    return;
  }
  loading.value = true;
  try {
    summary.value = await fetchReportSummary(store.selectedStudentId, period.value);
  } finally {
    loading.value = false;
  }
};

const download = async () => {
  if (!store.selectedStudentId) {
    return;
  }
  const blob = await exportReport(store.selectedStudentId, period.value);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${period.value}-report-student-${store.selectedStudentId}.csv`;
  link.click();
  URL.revokeObjectURL(url);
};

onMounted(async () => {
  if (!store.selectedStudentId) {
    await store.bootstrapAccounts();
  }
  await loadSummary();
});
</script>

<template>
  <section class="report-page">
    <header>
      <h1>学习报告</h1>
      <p>支持周报/月报导出，用于班级复盘与家校反馈。</p>
    </header>

    <div class="actions">
      <select v-model="period" @change="loadSummary">
        <option value="weekly">周报</option>
        <option value="monthly">月报</option>
      </select>
      <button class="primary" @click="download">导出 CSV</button>
    </div>

    <section v-if="summary" class="summary">
      <div class="grid">
        <article>
          <h3>学生</h3>
          <p>{{ summary.studentName }}（{{ summary.className }}）</p>
        </article>
        <article>
          <h3>统计区间</h3>
          <p>{{ summary.startDate }} ~ {{ summary.endDate }}</p>
        </article>
        <article>
          <h3>打卡天数</h3>
          <p>{{ summary.checkinDays }} 天</p>
        </article>
        <article>
          <h3>默写正确率</h3>
          <p>{{ summary.spellingAccuracy }}%</p>
        </article>
      </div>

      <div class="details">
        <p>跟读次数：{{ summary.readingCount }}</p>
        <p>默写次数：{{ summary.spellingCount }}</p>
      </div>

      <h2>高频错词</h2>
      <ul>
        <li v-for="item in summary.topWrongWords" :key="item.word">{{ item.word }}（{{ item.wrongCount }} 次）</li>
      </ul>
    </section>

    <p v-if="loading" class="tip">正在生成报告...</p>
  </section>
</template>

<style scoped>
.report-page {
  display: grid;
  gap: 16px;
}

header h1 {
  margin: 0;
  color: #1a1d22;
}

header p {
  margin: 6px 0 0;
  color: #5e6670;
}

.actions {
  display: flex;
  gap: 8px;
}

.actions select {
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.86);
  padding: 8px 10px;
}

.primary {
  border: none;
  border-radius: 10px;
  background: #0071e3;
  color: #fff;
  padding: 8px 14px;
  cursor: pointer;
}

.summary {
  background: rgba(255, 255, 255, 0.82);
  border: 1px solid rgba(0, 0, 0, 0.07);
  border-radius: 20px;
  box-shadow: 0 16px 34px rgba(15, 20, 28, 0.08);
  backdrop-filter: blur(10px);
  padding: 14px;
}

.grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(180px, 1fr));
  gap: 10px;
}

.grid article {
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 12px;
  padding: 10px;
}

.grid h3 {
  margin: 0;
  font-size: 13px;
  color: #5b6671;
}

.grid p {
  margin: 6px 0 0;
  color: #1f252b;
}

.details {
  margin-top: 10px;
  color: #47515b;
}

ul {
  margin: 8px 0 0;
  padding-left: 18px;
  color: #2a3139;
}

.tip {
  color: #5e6670;
}

@media (max-width: 680px) {
  .actions {
    flex-direction: column;
  }

  .grid {
    grid-template-columns: 1fr;
  }
}
</style>
