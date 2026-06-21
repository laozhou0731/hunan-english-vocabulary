import dayjs from 'dayjs';
import { defineStore } from 'pinia';
import {
  fetchDailyPlan,
  fetchOverviewStats,
  fetchWrongWords,
  fetchWordLibrary,
  submitCheckin,
  submitReading,
  submitSpelling
} from '../api';
import type { DailyPlanResponse, LibraryWord, OverviewStats, WrongWord } from '../types';

type SpellingFeedback = {
  ok: boolean;
  message: string;
};

export const useStudyStore = defineStore('study', {
  state: () => ({
    today: dayjs().format('YYYY-MM-DD'),
    plan: null as DailyPlanResponse | null,
    stats: null as OverviewStats | null,
    library: [] as LibraryWord[],
    wrongWords: [] as WrongWord[],
    loadingPlan: false,
    loadingStats: false,
    loadingLibrary: false,
    loadingWrongWords: false,
    checkinMessage: '',
    spellingFeedback: '' as string
  }),
  getters: {
    completionRate(state): number {
      if (!state.plan || state.plan.total === 0) {
        return 0;
      }
      return Math.round((state.plan.completed / state.plan.total) * 100);
    },
    unlockedCheckin(state): boolean {
      if (!state.plan) {
        return false;
      }
      return state.plan.completed >= state.plan.total && state.plan.total > 0;
    }
  },
  actions: {
    async loadPlan() {
      this.loadingPlan = true;
      try {
        this.plan = await fetchDailyPlan(this.today);
      } finally {
        this.loadingPlan = false;
      }
    },
    async loadStats(days = 30) {
      this.loadingStats = true;
      try {
        this.stats = await fetchOverviewStats(days);
      } finally {
        this.loadingStats = false;
      }
    },
    async loadLibrary(query = '', level = '') {
      this.loadingLibrary = true;
      try {
        this.library = await fetchWordLibrary(query, level);
      } finally {
        this.loadingLibrary = false;
      }
    },
    async loadWrongWords(limit = 80) {
      this.loadingWrongWords = true;
      try {
        this.wrongWords = await fetchWrongWords(limit);
      } finally {
        this.loadingWrongWords = false;
      }
    },
    async markReading(wordId: number) {
      await submitReading(wordId, this.today);
      await this.loadPlan();
      await this.loadStats();
    },
    async markSpelling(wordId: number, answer: string): Promise<SpellingFeedback> {
      const result = await submitSpelling(wordId, this.today, answer);
      await this.loadPlan();
      await this.loadStats();

      if (result.isCorrect) {
        this.spellingFeedback = '默写正确，继续加油';
        return { ok: true, message: this.spellingFeedback };
      }

      this.spellingFeedback = `拼写有误，正确答案：${result.target}`;
      return { ok: false, message: this.spellingFeedback };
    },
    async checkinToday() {
      const data = await submitCheckin(this.today);
      this.checkinMessage = data.message + (data.streak ? `，连续 ${data.streak} 天` : '');
      await this.loadStats();
      return data;
    }
  }
});
