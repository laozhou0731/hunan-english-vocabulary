import axios from 'axios';
import type {
  AccountsBootstrap,
  DailyPlanResponse,
  LibraryWord,
  OverviewStats,
  ReportSummary,
  SpellingResult,
  WrongWord
} from './types';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api';

const http = axios.create({
  baseURL: API_BASE,
  timeout: 10000
});

export const fetchDailyPlan = async (date: string, studentId: number) => {
  const { data } = await http.get<DailyPlanResponse>('/daily-plan', { params: { date, studentId } });
  return data;
};

export const submitReading = async (wordId: number, date: string, studentId: number, durationSec = 8) => {
  await http.post(`/daily-plan/${wordId}/reading`, { date, studentId, durationSec });
};

export const submitSpelling = async (wordId: number, date: string, studentId: number, answer: string, durationSec = 15) => {
  const { data } = await http.post<SpellingResult>(
    `/daily-plan/${wordId}/spelling`,
    { date, studentId, answer, durationSec }
  );
  return data;
};

export const submitCheckin = async (date: string, studentId: number) => {
  const { data } = await http.post<{ success: boolean; streak?: number; message: string }>('/checkin', { date, studentId });
  return data;
};

export const fetchOverviewStats = async (studentId: number, days = 30) => {
  const { data } = await http.get<OverviewStats>('/stats/overview', { params: { days, studentId } });
  return data;
};

export const fetchWordLibrary = async (studentId: number, query = '', level = '') => {
  const { data } = await http.get<LibraryWord[]>('/words', { params: { query, level, studentId } });
  return data;
};

export const fetchWrongWords = async (studentId: number, limit = 80) => {
  const { data } = await http.get<WrongWord[]>('/words/wrong', { params: { limit, studentId } });
  return data;
};

export const fetchAccountsBootstrap = async () => {
  const { data } = await http.get<AccountsBootstrap>('/accounts/bootstrap');
  return data;
};

export const fetchReportSummary = async (studentId: number, period: 'weekly' | 'monthly') => {
  const { data } = await http.get<ReportSummary>('/reports/summary', { params: { studentId, period } });
  return data;
};

export const exportReport = async (studentId: number, period: 'weekly' | 'monthly') => {
  const { data } = await http.get('/reports/export', {
    params: { studentId, period },
    responseType: 'blob'
  });
  return data as Blob;
};
