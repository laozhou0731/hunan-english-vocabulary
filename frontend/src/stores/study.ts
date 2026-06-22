import dayjs from 'dayjs';
import { defineStore } from 'pinia';
import {
  fetchAccountsBootstrap,
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

const STUDENT_ID_KEY = 'hev_student_id';

export const useStudyStore = defineStore('study', {
  state: () => ({
    today: dayjs().format('YYYY-MM-DD'),
    plan: null as DailyPlanResponse | null,
    stats: null as OverviewStats | null,
    library: [] as LibraryWord[],
    wrongWords: [] as WrongWord[],
    selectedStudentId: null as number | null,
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
    async bootstrapAccounts() {
      try {
        const data = await fetchAccountsBootstrap();

        const saved = Number(localStorage.getItem(STUDENT_ID_KEY) ?? 0);
        const fallback = data.defaultStudentId ?? null;
        const selected = saved > 0 ? saved : fallback;

        this.selectedStudentId = selected;

        if (selected) {
          localStorage.setItem(STUDENT_ID_KEY, String(selected));
        }
      } finally {
        if (!this.selectedStudentId) {
          this.selectedStudentId = 1;
        }
      }
    },
    async loadPlan() {
      if (!this.selectedStudentId) {
        return;
      }
      this.loadingPlan = true;
      try {
        this.plan = await fetchDailyPlan(this.today, this.selectedStudentId);
      } finally {
        this.loadingPlan = false;
      }
    },
    async loadStats(days = 30) {
      if (!this.selectedStudentId) {
        return;
      }
      this.loadingStats = true;
      try {
        this.stats = await fetchOverviewStats(this.selectedStudentId, days);
      } finally {
        this.loadingStats = false;
      }
    },
    async loadLibrary(query = '', level = '') {
      if (!this.selectedStudentId) {
        return;
      }
      this.loadingLibrary = true;
      try {
        this.library = await fetchWordLibrary(this.selectedStudentId, query, level);
      } finally {
        this.loadingLibrary = false;
      }
    },
    async loadWrongWords(limit = 80) {
      if (!this.selectedStudentId) {
        return;
      }
      this.loadingWrongWords = true;
      try {
        this.wrongWords = await fetchWrongWords(this.selectedStudentId, limit);
      } finally {
        this.loadingWrongWords = false;
      }
    },
    async markReading(wordId: number) {
      if (!this.selectedStudentId) {
        return;
      }
      await submitReading(wordId, this.today, this.selectedStudentId);
      await this.loadPlan();
      await this.loadStats();
    },
    async markSpelling(wordId: number, answer: string): Promise<SpellingFeedback> {
      if (!this.selectedStudentId) {
        return { ok: false, message: '请先选择学生账号' };
      }

      const result = await submitSpelling(wordId, this.today, this.selectedStudentId, answer);
      await this.loadPlan();
      await this.loadStats();
      await this.loadWrongWords(120);

      if (result.isCorrect) {
        this.spellingFeedback = '默写正确，继续加油';
        return { ok: true, message: this.spellingFeedback };
      }

      this.spellingFeedback = `拼写有误，正确答案：${result.target}；提示：${result.hint}`;
      return { ok: false, message: this.spellingFeedback };
    },
    async checkinToday() {
      if (!this.selectedStudentId) {
        return { success: false, message: '请先选择学生账号' };
      }
      const data = await submitCheckin(this.today, this.selectedStudentId);
      this.checkinMessage = data.message + (data.streak ? `，连续 ${data.streak} 天` : '');
      await this.loadStats();
      return data;
    }
  }
});
