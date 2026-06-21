import fs from 'node:fs';
import path from 'node:path';
import dayjs from 'dayjs';
import { Database, open } from 'sqlite';
import sqlite3 from 'sqlite3';
import { seedWords, type SeedWord } from './seedWords';

export type AppDatabase = Database<sqlite3.Database, sqlite3.Statement>;

const DB_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DB_DIR, 'vocabulary.db');
const FULL_WORDS_JSON = path.resolve(process.cwd(), 'src/data/full-words.json');

let dbInstance: AppDatabase | null = null;

const ensureDbDir = () => {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
};

const normalizeSpelling = (value: string) => value.toLowerCase().replace(/[^a-z]/g, '');

const toAudioUrl = (word: string) => `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(word)}&type=2`;

const loadWordSource = (): SeedWord[] => {
  if (!fs.existsSync(FULL_WORDS_JSON)) {
    return seedWords;
  }

  try {
    const raw = fs.readFileSync(FULL_WORDS_JSON, 'utf8');
    const parsed = JSON.parse(raw) as SeedWord[];
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    return seedWords;
  } catch (error) {
    console.warn('Load full-words.json failed, fallback to seedWords', error);
    return seedWords;
  }
};

export const getDb = async () => {
  if (dbInstance) {
    return dbInstance;
  }

  ensureDbDir();
  dbInstance = await open({
    filename: DB_FILE,
    driver: sqlite3.Database
  });
  await dbInstance.exec('PRAGMA foreign_keys = ON;');

  await dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS words (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      word TEXT UNIQUE NOT NULL,
      phonetic TEXT NOT NULL,
      meaning TEXT NOT NULL,
      level TEXT NOT NULL,
      category TEXT NOT NULL,
      audio_url TEXT NOT NULL,
      times_seen INTEGER NOT NULL DEFAULT 0,
      times_correct INTEGER NOT NULL DEFAULT 0,
      last_reviewed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS daily_plans (
      plan_date TEXT PRIMARY KEY,
      total_words INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS daily_plan_words (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_date TEXT NOT NULL,
      word_id INTEGER NOT NULL,
      order_index INTEGER NOT NULL,
      reading_done INTEGER NOT NULL DEFAULT 0,
      spelling_done INTEGER NOT NULL DEFAULT 0,
      spelling_attempts INTEGER NOT NULL DEFAULT 0,
      spelling_correct INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      UNIQUE(plan_date, word_id),
      FOREIGN KEY (plan_date) REFERENCES daily_plans(plan_date) ON DELETE CASCADE,
      FOREIGN KEY (word_id) REFERENCES words(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS checkins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_date TEXT UNIQUE NOT NULL,
      streak INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS study_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_date TEXT NOT NULL,
      word_id INTEGER NOT NULL,
      activity TEXT NOT NULL,
      is_correct INTEGER NOT NULL,
      duration_sec INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (word_id) REFERENCES words(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_daily_plan_words_date ON daily_plan_words(plan_date);
    CREATE INDEX IF NOT EXISTS idx_study_logs_date ON study_logs(plan_date);
  `);

  const row = await dbInstance.get<{ count: number }>('SELECT COUNT(*) AS count FROM words');
  if (!row || row.count === 0) {
    const sourceWords = loadWordSource();
    const insertSql = `
      INSERT INTO words (word, phonetic, meaning, level, category, audio_url)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    for (const item of sourceWords) {
      await dbInstance.run(insertSql, [
        item.word,
        item.phonetic,
        item.meaning,
        item.level,
        item.category,
        toAudioUrl(item.word)
      ]);
    }
  }

  return dbInstance;
};

export type PlanWord = {
  id: number;
  word: string;
  phonetic: string;
  meaning: string;
  level: string;
  category: string;
  audioUrl: string;
  readingDone: boolean;
  spellingDone: boolean;
  spellingAttempts: number;
  spellingCorrect: boolean;
};

export const ensureDailyPlan = async (planDate: string, targetSize = 30) => {
  const db = await getDb();
  const existing = await db.get<{ plan_date: string }>('SELECT plan_date FROM daily_plans WHERE plan_date = ?', [planDate]);
  if (!existing) {
    const now = dayjs().toISOString();
    await db.run('INSERT INTO daily_plans (plan_date, total_words, created_at) VALUES (?, ?, ?)', [planDate, targetSize, now]);

    const selected = await db.all<{ id: number }[]>(
      `
      SELECT id
      FROM words
      ORDER BY
        CASE WHEN last_reviewed_at IS NULL THEN 0 ELSE 1 END,
        last_reviewed_at ASC,
        RANDOM()
      LIMIT ?
      `,
      [targetSize]
    );

    let order = 1;
    for (const word of selected) {
      await db.run(
        `
        INSERT INTO daily_plan_words (plan_date, word_id, order_index, created_at)
        VALUES (?, ?, ?, ?)
        `,
        [planDate, word.id, order, now]
      );
      order += 1;
    }
  }

  const words = await db.all<PlanWord[]>(
    `
    SELECT
      w.id,
      w.word,
      w.phonetic,
      w.meaning,
      w.level,
      w.category,
      w.audio_url AS audioUrl,
      dpw.reading_done AS readingDone,
      dpw.spelling_done AS spellingDone,
      dpw.spelling_attempts AS spellingAttempts,
      dpw.spelling_correct AS spellingCorrect
    FROM daily_plan_words dpw
    JOIN words w ON w.id = dpw.word_id
    WHERE dpw.plan_date = ?
    ORDER BY dpw.order_index ASC
    `,
    [planDate]
  );

  return words.map((item) => ({
    ...item,
    readingDone: Boolean(item.readingDone),
    spellingDone: Boolean(item.spellingDone),
    spellingCorrect: Boolean(item.spellingCorrect)
  }));
};

export const markReadingDone = async (planDate: string, wordId: number, durationSec: number) => {
  const db = await getDb();
  const now = dayjs().toISOString();

  await db.run(
    `
    UPDATE daily_plan_words
    SET reading_done = 1
    WHERE plan_date = ? AND word_id = ?
    `,
    [planDate, wordId]
  );

  await db.run(
    `
    INSERT INTO study_logs (plan_date, word_id, activity, is_correct, duration_sec, created_at)
    VALUES (?, ?, 'reading', 1, ?, ?)
    `,
    [planDate, wordId, durationSec, now]
  );

  await db.run(
    `
    UPDATE words
    SET times_seen = times_seen + 1,
        times_correct = times_correct + 1,
        last_reviewed_at = ?
    WHERE id = ?
    `,
    [now, wordId]
  );
};

export const markSpelling = async (planDate: string, wordId: number, answer: string, durationSec: number) => {
  const db = await getDb();
  const now = dayjs().toISOString();
  const target = await db.get<{ word: string }>('SELECT word FROM words WHERE id = ?', [wordId]);
  if (!target) {
    throw new Error('Word not found');
  }

  const isCorrect = normalizeSpelling(target.word) === normalizeSpelling(answer);

  await db.run(
    `
    UPDATE daily_plan_words
    SET spelling_done = CASE WHEN ? = 1 THEN 1 ELSE spelling_done END,
        spelling_attempts = spelling_attempts + 1,
        spelling_correct = CASE WHEN ? = 1 THEN 1 ELSE spelling_correct END
    WHERE plan_date = ? AND word_id = ?
    `,
    [isCorrect ? 1 : 0, isCorrect ? 1 : 0, planDate, wordId]
  );

  await db.run(
    `
    INSERT INTO study_logs (plan_date, word_id, activity, is_correct, duration_sec, created_at)
    VALUES (?, ?, 'spelling', ?, ?, ?)
    `,
    [planDate, wordId, isCorrect ? 1 : 0, durationSec, now]
  );

  await db.run(
    `
    UPDATE words
    SET times_seen = times_seen + 1,
        times_correct = times_correct + ?,
        last_reviewed_at = ?
    WHERE id = ?
    `,
    [isCorrect ? 1 : 0, now, wordId]
  );

  return {
    isCorrect,
    target: target.word
  };
};

export const createCheckinIfEligible = async (planDate: string) => {
  const db = await getDb();
  const progress = await db.get<{ total: number; done: number }>(
    `
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN reading_done = 1 AND spelling_done = 1 THEN 1 ELSE 0 END) AS done
    FROM daily_plan_words
    WHERE plan_date = ?
    `,
    [planDate]
  );

  const total = progress?.total ?? 0;
  const done = progress?.done ?? 0;

  if (total === 0 || done < total) {
    return { success: false, message: '请先完成当日30词跟读和默写' };
  }

  const existing = await db.get('SELECT id, streak FROM checkins WHERE plan_date = ?', [planDate]);
  if (existing) {
    return { success: true, streak: (existing as { streak: number }).streak, message: '今日已打卡' };
  }

  const yesterday = dayjs(planDate).subtract(1, 'day').format('YYYY-MM-DD');
  const yesterdayCheckin = await db.get<{ streak: number }>('SELECT streak FROM checkins WHERE plan_date = ?', [yesterday]);
  const streak = (yesterdayCheckin?.streak ?? 0) + 1;

  await db.run(
    'INSERT INTO checkins (plan_date, streak, created_at) VALUES (?, ?, ?)',
    [planDate, streak, dayjs().toISOString()]
  );

  return { success: true, streak, message: '打卡成功' };
};

export const getOverviewStats = async (rangeDays: number) => {
  const db = await getDb();
  const safeRange = Number.isFinite(rangeDays) ? Math.max(7, Math.min(rangeDays, 120)) : 30;

  const [wordStats, streakRow, todayCompletion, progressRows, accuracyRows, weakRows] = await Promise.all([
    db.get<{ total: number; learned: number; mastered: number }>(
      `
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN times_seen > 0 THEN 1 ELSE 0 END) AS learned,
        SUM(CASE WHEN times_seen >= 3 AND CAST(times_correct AS REAL) / times_seen >= 0.8 THEN 1 ELSE 0 END) AS mastered
      FROM words
      `
    ),
    db.get<{ streak: number }>('SELECT streak FROM checkins ORDER BY plan_date DESC LIMIT 1'),
    db.get<{ total: number; done: number }>(
      `
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN reading_done = 1 AND spelling_done = 1 THEN 1 ELSE 0 END) AS done
      FROM daily_plan_words
      WHERE plan_date = ?
      `,
      [dayjs().format('YYYY-MM-DD')]
    ),
    db.all<{ planDate: string; completed: number; total: number }[]>(
      `
      SELECT
        dp.plan_date AS planDate,
        SUM(CASE WHEN dpw.reading_done = 1 AND dpw.spelling_done = 1 THEN 1 ELSE 0 END) AS completed,
        COUNT(*) AS total
      FROM daily_plans dp
      LEFT JOIN daily_plan_words dpw ON dpw.plan_date = dp.plan_date
      WHERE dp.plan_date >= ?
      GROUP BY dp.plan_date
      ORDER BY dp.plan_date ASC
      `,
      [dayjs().subtract(safeRange - 1, 'day').format('YYYY-MM-DD')]
    ),
    db.all<{ planDate: string; accuracy: number }[]>(
      `
      SELECT
        plan_date AS planDate,
        ROUND(100.0 * SUM(CASE WHEN activity = 'spelling' AND is_correct = 1 THEN 1 ELSE 0 END) /
          NULLIF(SUM(CASE WHEN activity = 'spelling' THEN 1 ELSE 0 END), 0), 2) AS accuracy
      FROM study_logs
      WHERE plan_date >= ?
      GROUP BY plan_date
      ORDER BY plan_date ASC
      `,
      [dayjs().subtract(safeRange - 1, 'day').format('YYYY-MM-DD')]
    ),
    db.all<{ word: string; meaning: string; accuracy: number; seen: number }[]>(
      `
      SELECT
        word,
        meaning,
        ROUND(100.0 * times_correct / NULLIF(times_seen, 0), 2) AS accuracy,
        times_seen AS seen
      FROM words
      WHERE times_seen >= 2
      ORDER BY accuracy ASC, seen DESC
      LIMIT 10
      `
    )
  ]);

  return {
    totalWords: wordStats?.total ?? 0,
    learnedWords: wordStats?.learned ?? 0,
    masteredWords: wordStats?.mastered ?? 0,
    currentStreak: streakRow?.streak ?? 0,
    today: {
      total: todayCompletion?.total ?? 0,
      completed: todayCompletion?.done ?? 0
    },
    progressSeries: progressRows,
    accuracySeries: accuracyRows,
    weakWords: weakRows
  };
};

export const getWordLibrary = async (query?: string, level?: string) => {
  const db = await getDb();
  const keyword = query?.trim() ?? '';

  const rows = await db.all<
    {
      id: number;
      word: string;
      phonetic: string;
      meaning: string;
      level: string;
      category: string;
      audioUrl: string;
      timesSeen: number;
      accuracy: number | null;
    }[]
  >(
    `
    SELECT
      id,
      word,
      phonetic,
      meaning,
      level,
      category,
      audio_url AS audioUrl,
      times_seen AS timesSeen,
      ROUND(100.0 * times_correct / NULLIF(times_seen, 0), 2) AS accuracy
    FROM words
    WHERE (? = '' OR word LIKE '%' || ? || '%' OR meaning LIKE '%' || ? || '%')
      AND (? = '' OR level = ?)
    ORDER BY level ASC, word ASC
    `,
    [keyword, keyword, keyword, level ?? '', level ?? '']
  );

  return rows;
};

export const getWrongWordList = async (limit = 80) => {
  const db = await getDb();
  const safeLimit = Number.isFinite(limit) ? Math.max(10, Math.min(limit, 300)) : 80;

  const rows = await db.all<
    {
      id: number;
      word: string;
      phonetic: string;
      meaning: string;
      level: string;
      category: string;
      timesSeen: number;
      timesCorrect: number;
      wrongCount: number;
      accuracy: number;
      lastReviewedAt: string | null;
    }[]
  >(
    `
    SELECT
      id,
      word,
      phonetic,
      meaning,
      level,
      category,
      times_seen AS timesSeen,
      times_correct AS timesCorrect,
      (times_seen - times_correct) AS wrongCount,
      ROUND(100.0 * times_correct / NULLIF(times_seen, 0), 2) AS accuracy,
      last_reviewed_at AS lastReviewedAt
    FROM words
    WHERE times_seen >= 3
      AND (times_seen - times_correct) >= 1
    ORDER BY wrongCount DESC, accuracy ASC, times_seen DESC
    LIMIT ?
    `,
    [safeLimit]
  );

  return rows;
};
