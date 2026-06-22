<script setup lang="ts">
import { onMounted, reactive } from 'vue';
import { useStudyStore } from '../stores/study';
import type { PlanWord } from '../types';

const store = useStudyStore();

const spellingInputs = reactive<Record<number, string>>({});
const localMessage = reactive<Record<number, string>>({});
const dictationMode = reactive<Record<number, boolean>>({});

const shouldHideWord = (item: PlanWord) => Boolean(dictationMode[item.id]) && !item.spellingDone;

const maskedWord = (word: string) => {
  const length = Math.max(4, Math.min(word.length, 10));
  return '•'.repeat(length);
};

const playAudio = (url: string) => {
  const audio = new Audio(url);
  audio.play().catch(() => {
    /* ignore autoplay block */
  });
};

const submitSpellingById = async (wordId: number) => {
  const answer = spellingInputs[wordId]?.trim();
  if (!answer) {
    localMessage[wordId] = '请先输入拼写';
    return;
  }

  const result = await store.markSpelling(wordId, answer);
  localMessage[wordId] = result.message;
  if (result.ok) {
    dictationMode[wordId] = false;
  }
};

const startDictation = (wordId: number) => {
  dictationMode[wordId] = true;
};

onMounted(async () => {
  if (!store.selectedStudentId) {
    await store.bootstrapAccounts();
  }
  await Promise.all([store.loadPlan(), store.loadStats()]);
});
</script>

<template>
  <section class="page">
    <header class="hero">
      <p class="date">DAY PLAN {{ store.today }}</p>
      <h1>每日 20 词学习闭环</h1>
      <p class="progress">今日完成 {{ store.plan?.completed ?? 0 }} / {{ store.plan?.total ?? 20 }}（{{ store.completionRate }}%）</p>
      <div class="checkin-row">
        <button class="checkin-btn" :disabled="!store.unlockedCheckin" @click="store.checkinToday">
          {{ store.unlockedCheckin ? '立即打卡' : '完成20词后可打卡' }}
        </button>
        <span class="checkin-msg">{{ store.checkinMessage }}</span>
      </div>
    </header>

    <main class="word-grid" v-if="store.plan">
      <article class="word-card" v-for="item in store.plan.words" :key="item.id">
        <div class="head">
          <h3>
            {{ shouldHideWord(item) ? maskedWord(item.word) : item.word }}
          </h3>
          <span>{{ item.level }}</span>
        </div>
        <p class="meta">
          {{ item.phonetic }} · {{ item.category }}{{ shouldHideWord(item) ? ' · 默写中' : '' }}
        </p>
        <p class="meaning">{{ item.meaning }}</p>

        <div class="actions">
          <button class="secondary" @click="playAudio(item.audioUrl)">播放发音</button>
          <button class="primary" :disabled="item.readingDone" @click="store.markReading(item.id)">
            {{ item.readingDone ? '已完成跟读' : '完成跟读' }}
          </button>
          <button
            v-if="item.readingDone && !item.spellingDone && !dictationMode[item.id]"
            class="primary"
            @click="startDictation(item.id)"
          >
            开始默写
          </button>
        </div>

        <div v-if="dictationMode[item.id] || item.spellingDone" class="spelling">
          <input
            v-model="spellingInputs[item.id]"
            :placeholder="item.spellingDone ? '已通过默写' : '输入英文拼写进行默写'"
            :disabled="item.spellingDone"
          />
          <button class="primary" :disabled="item.spellingDone" @click="submitSpellingById(item.id)">
            {{ item.spellingDone ? '默写通过' : '提交默写' }}
          </button>
        </div>

        <p v-else-if="item.readingDone" class="hint">点击“开始默写”后将隐藏单词。</p>

        <p class="feedback">{{ localMessage[item.id] }}</p>
      </article>
    </main>

    <p v-else class="loading">正在生成今日学习计划...</p>
  </section>
</template>

<style scoped>
.page {
  display: grid;
  gap: 24px;
}

.hero {
  background: linear-gradient(160deg, rgba(255, 255, 255, 0.88), rgba(245, 247, 250, 0.84));
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 28px;
  padding: 28px;
  color: #101214;
  box-shadow: 0 18px 44px rgba(15, 20, 28, 0.08);
  backdrop-filter: blur(14px);
}

.date {
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  font-size: 12px;
  color: #6e7680;
}

.hero h1 {
  margin: 10px 0;
  font-size: clamp(28px, 4vw, 44px);
  letter-spacing: -0.02em;
}

.progress {
  margin: 0;
  font-size: 16px;
  color: #3a4048;
}

.checkin-row {
  margin-top: 14px;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}

.checkin-btn {
  border: none;
  border-radius: 999px;
  background: #0071e3;
  color: #ffffff;
  padding: 10px 18px;
  font-weight: 600;
  cursor: pointer;
}

.checkin-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.checkin-msg {
  color: #4a535c;
  font-size: 14px;
}

.word-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(270px, 1fr));
  gap: 14px;
}

.word-card {
  background: rgba(255, 255, 255, 0.82);
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 22px;
  padding: 16px;
  box-shadow: 0 12px 34px rgba(15, 20, 28, 0.08);
  backdrop-filter: blur(10px);
}

.head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px;
}

.head h3 {
  margin: 0;
  font-size: 28px;
  color: #111418;
  letter-spacing: -0.02em;
}

.head span {
  font-size: 12px;
  color: #65707c;
}

.meta {
  margin: 6px 0;
  color: #5d6873;
  font-size: 13px;
}

.meaning {
  margin: 0 0 10px;
  color: #1a1f24;
}

.actions,
.spelling {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.spelling input {
  flex: 1;
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 10px;
  padding: 9px 10px;
  background: rgba(255, 255, 255, 0.9);
}

.primary,
.secondary {
  border: none;
  border-radius: 10px;
  padding: 8px 12px;
  cursor: pointer;
  font-weight: 600;
}

.primary {
  background: #0071e3;
  color: #fff;
}

.secondary {
  background: #f3f6f9;
  color: #222831;
}

.feedback {
  min-height: 18px;
  margin: 8px 0 0;
  color: #4f5a65;
  font-size: 13px;
}

.hint {
  margin: 8px 0 0;
  color: #6a7480;
  font-size: 13px;
}

.loading {
  color: #4f5a65;
}

@media (max-width: 600px) {
  .hero {
    padding: 18px;
    border-radius: 22px;
  }

  .hero h1 {
    font-size: 30px;
    line-height: 1.18;
  }

  .progress {
    font-size: 14px;
  }

  .word-grid {
    grid-template-columns: 1fr;
  }

  .word-card {
    border-radius: 18px;
    padding: 14px;
  }

  .head h3 {
    font-size: 24px;
  }

  .actions,
  .spelling {
    flex-direction: column;
  }

  .primary,
  .secondary {
    width: 100%;
    min-height: 40px;
  }

  .spelling input {
    min-height: 40px;
  }
}
</style>
