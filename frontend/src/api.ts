import axios from 'axios';
import type { DailyPlanResponse, LibraryWord, OverviewStats, WrongWord } from './types';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api';

const http = axios.create({
  baseURL: API_BASE,
  timeout: 10000
});

export const fetchDailyPlan = async (date: string) => {
  const { data } = await http.get<DailyPlanResponse>('/daily-plan', { params: { date } });
  return data;
};

export const submitReading = async (wordId: number, date: string, durationSec = 8) => {
  await http.post(`/daily-plan/${wordId}/reading`, { date, durationSec });
};

export const submitSpelling = async (wordId: number, date: string, answer: string, durationSec = 15) => {
  const { data } = await http.post<{ success: boolean; isCorrect: boolean; target: string }>(
    `/daily-plan/${wordId}/spelling`,
    { date, answer, durationSec }
  );
  return data;
};

export const submitCheckin = async (date: string) => {
  const { data } = await http.post<{ success: boolean; streak?: number; message: string }>('/checkin', { date });
  return data;
};

export const fetchOverviewStats = async (days = 30) => {
  const { data } = await http.get<OverviewStats>('/stats/overview', { params: { days } });
  return data;
};

export const fetchWordLibrary = async (query = '', level = '') => {
  const { data } = await http.get<LibraryWord[]>('/words', { params: { query, level } });
  return data;
};

export const fetchWrongWords = async (limit = 80) => {
  const { data } = await http.get<WrongWord[]>('/words/wrong', { params: { limit } });
  return data;
};
