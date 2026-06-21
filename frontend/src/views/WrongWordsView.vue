<script setup lang="ts">
import { computed, onMounted } from 'vue';
import dayjs from 'dayjs';
import { useStudyStore } from '../stores/study';

const store = useStudyStore();

const rows = computed(() => store.wrongWords);

const formatTime = (value: string | null) => {
  if (!value) return '-';
  return dayjs(value).format('MM-DD HH:mm');
};

onMounted(async () => {
  await store.loadWrongWords(120);
});
</script>

<template>
  <section class="wrong-page">
    <header>
      <h1>错词本</h1>
      <p>自动收录高频错误单词，优先复习最容易失分的词。</p>
    </header>

    <section class="panel">
      <table v-if="rows.length > 0">
        <thead>
          <tr>
            <th>单词</th>
            <th>释义</th>
            <th>错误次数</th>
            <th>正确率</th>
            <th>最近练习</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in rows" :key="item.id">
            <td data-label="单词">
              <strong>{{ item.word }}</strong>
              <p>{{ item.phonetic }}</p>
            </td>
            <td data-label="释义">{{ item.meaning }}</td>
            <td data-label="错误次数">{{ item.wrongCount }}</td>
            <td data-label="正确率">{{ item.accuracy }}%</td>
            <td data-label="最近练习">{{ formatTime(item.lastReviewedAt) }}</td>
          </tr>
        </tbody>
      </table>
      <p v-else class="empty">当前还没有形成错词，继续学习后会自动生成。</p>
    </section>
  </section>
</template>

<style scoped>
.wrong-page {
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

.panel {
  background: rgba(255, 255, 255, 0.82);
  border: 1px solid rgba(0, 0, 0, 0.07);
  border-radius: 20px;
  box-shadow: 0 16px 34px rgba(15, 20, 28, 0.08);
  backdrop-filter: blur(10px);
  overflow: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  min-width: 720px;
}

th,
td {
  padding: 12px 10px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.07);
  text-align: left;
  color: #2a3139;
  font-size: 14px;
}

td p {
  margin: 4px 0 0;
  color: #697684;
  font-size: 12px;
}

.empty {
  margin: 0;
  padding: 24px 16px;
  color: #5e6670;
}

@media (max-width: 720px) {
  table {
    min-width: 100%;
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
    padding: 10px;
  }

  td {
    border-bottom: none;
    padding: 5px 0;
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
