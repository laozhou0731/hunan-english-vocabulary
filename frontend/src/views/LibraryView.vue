<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useStudyStore } from '../stores/study';

const store = useStudyStore();
const keyword = ref('');
const level = ref('');

const levels = ['必修一', '必修二', '必修三', '选择性必修一', '选择性必修二', '选择性必修三', '选择性必修四'];

const search = async () => {
  await store.loadLibrary(keyword.value, level.value);
};

const playAudio = (url: string) => {
  const audio = new Audio(url);
  audio.play().catch(() => {
    /* ignore autoplay block */
  });
};

onMounted(async () => {
  if (!store.selectedStudentId) {
    await store.bootstrapAccounts();
  }
  await search();
});
</script>

<template>
  <section class="library-page">
    <header>
      <h1>高中词库检索</h1>
      <p>按教材模块与关键词快速定位，支持逐词发音跟读。</p>
    </header>

    <div class="filters">
      <input v-model="keyword" placeholder="输入英文或中文释义关键词" />
      <select v-model="level">
        <option value="">全部模块</option>
        <option v-for="item in levels" :key="item" :value="item">{{ item }}</option>
      </select>
      <button @click="search">查询</button>
    </div>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>单词</th>
            <th>音标</th>
            <th>释义</th>
            <th>模块</th>
            <th>词性</th>
            <th>练习次数</th>
            <th>正确率</th>
            <th>音频</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in store.library" :key="item.id">
            <td data-label="单词">{{ item.word }}</td>
            <td data-label="音标">{{ item.phonetic }}</td>
            <td data-label="释义">{{ item.meaning }}</td>
            <td data-label="模块">{{ item.level }}</td>
            <td data-label="词性">{{ item.category }}</td>
            <td data-label="练习次数">{{ item.timesSeen }}</td>
            <td data-label="正确率">{{ item.accuracy ?? '-' }}{{ item.accuracy !== null ? '%' : '' }}</td>
            <td data-label="音频">
              <button class="audio-btn" @click="playAudio(item.audioUrl)">播放</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<style scoped>
.library-page {
  display: grid;
  gap: 16px;
}

header h1 {
  margin: 0;
  color: #1a1d21;
}

header p {
  margin: 6px 0 0;
  color: #5f6872;
}

.filters {
  display: grid;
  grid-template-columns: minmax(180px, 2fr) minmax(160px, 1fr) 110px;
  gap: 10px;
}

.filters input,
.filters select {
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 12px;
  padding: 10px;
  background: rgba(255, 255, 255, 0.86);
}

.filters button {
  border: none;
  border-radius: 12px;
  background: #0071e3;
  color: #fff;
  font-weight: 600;
  cursor: pointer;
}

.table-wrap {
  overflow: auto;
  background: rgba(255, 255, 255, 0.82);
  border-radius: 18px;
  border: 1px solid rgba(0, 0, 0, 0.07);
  box-shadow: 0 16px 34px rgba(15, 20, 28, 0.08);
  backdrop-filter: blur(10px);
}

table {
  width: 100%;
  border-collapse: collapse;
  min-width: 980px;
}

th,
td {
  padding: 10px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.07);
  text-align: left;
  color: #242a31;
  font-size: 14px;
}

.audio-btn {
  border: none;
  border-radius: 8px;
  background: #eef3f9;
  color: #2f3740;
  padding: 6px 10px;
  cursor: pointer;
}

@media (max-width: 720px) {
  .filters {
    grid-template-columns: 1fr;
  }

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
    padding: 10px 10px 8px;
  }

  td {
    border-bottom: none;
    padding: 6px 0;
    font-size: 13px;
  }

  td::before {
    content: attr(data-label) '：';
    display: inline-block;
    min-width: 70px;
    color: #5b6671;
    font-weight: 600;
  }

  .audio-btn {
    min-height: 36px;
  }
}
</style>
