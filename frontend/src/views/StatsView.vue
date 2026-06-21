<script setup lang="ts">
import { onMounted } from 'vue';
import KpiCard from '../components/KpiCard.vue';
import ProgressCharts from '../components/ProgressCharts.vue';
import { useStudyStore } from '../stores/study';

const store = useStudyStore();

onMounted(async () => {
  if (!store.selectedStudentId) {
    await store.bootstrapAccounts();
  }
  if (!store.stats) {
    await store.loadStats(30);
  }
});
</script>

<template>
  <section class="stats-page">
    <header>
      <h1>学习进度与效果分析</h1>
      <p>聚焦打卡连续性、默写正确率与薄弱词复盘</p>
    </header>

    <div class="kpi-grid" v-if="store.stats">
      <KpiCard title="词库总量" :value="store.stats.totalWords" subtitle="按课程标准收纳" />
      <KpiCard title="已学习" :value="store.stats.learnedWords" subtitle="出现过至少1次" />
      <KpiCard title="已掌握" :value="store.stats.masteredWords" subtitle="至少3次且正确率>=80%" />
      <KpiCard title="连续打卡" :value="store.stats.currentStreak" subtitle="坚持就是优势" />
    </div>

    <ProgressCharts :stats="store.stats" />

    <section class="weak" v-if="store.stats">
      <h2>薄弱词 Top 10</h2>
      <table>
        <thead>
          <tr>
            <th>单词</th>
            <th>释义</th>
            <th>正确率</th>
            <th>练习次数</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in store.stats.weakWords" :key="item.word">
            <td data-label="单词">{{ item.word }}</td>
            <td data-label="释义">{{ item.meaning }}</td>
            <td data-label="正确率">{{ item.accuracy ?? 0 }}%</td>
            <td data-label="练习次数">{{ item.seen }}</td>
          </tr>
        </tbody>
      </table>
    </section>
  </section>
</template>

<style scoped>
.stats-page {
  display: grid;
  gap: 20px;
}

header h1 {
  margin: 0;
  color: #1a1d22;
}

header p {
  margin: 6px 0 0;
  color: #5e6670;
}

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(140px, 1fr));
  gap: 12px;
}

.weak {
  background: rgba(255, 255, 255, 0.82);
  border-radius: 20px;
  border: 1px solid rgba(0, 0, 0, 0.07);
  padding: 14px;
  box-shadow: 0 16px 34px rgba(15, 20, 28, 0.08);
  backdrop-filter: blur(10px);
}

.weak h2 {
  margin: 6px 4px 12px;
  color: #1d2127;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

th,
td {
  padding: 10px 8px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.07);
  text-align: left;
  color: #2a3139;
}

@media (max-width: 900px) {
  .kpi-grid {
    grid-template-columns: repeat(2, minmax(140px, 1fr));
  }
}

@media (max-width: 500px) {
  .kpi-grid {
    grid-template-columns: 1fr;
  }

  .weak {
    padding: 12px;
    border-radius: 16px;
  }

  thead {
    display: none;
  }

  tbody,
  tr,
  td {
    display: block;
    width: 100%;
  }

  tr {
    border-bottom: 1px solid rgba(0, 0, 0, 0.07);
    padding: 8px 4px;
  }

  td {
    border-bottom: none;
    padding: 4px 0;
    font-size: 13px;
  }

  td::before {
    content: attr(data-label) '：';
    color: #5b6671;
    font-weight: 600;
    margin-right: 4px;
  }
}
</style>
