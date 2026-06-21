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
  } catch {
    return seedWords;
  }
};

const ensureDefaultAccounts = async (db: AppDatabase) => {
  const classCount = await db.get<{ count: number }>('SELECT COUNT(*) AS count FROM classes');
  if (!classCount || classCount.count === 0) {
    await db.run(
      `INSERT INTO classes (name, grade, created_at) VALUES (?, ?, ?)`,
      ['默认班级', '高一', dayjs().toISOString()]
    );
  }

  const studentCount = await db.get<{ count: number }>('SELECT COUNT(*) AS count FROM students');
  if (!studentCount || studentCount.count === 0) {
    const firstClass = await db.get<{ id: number }>('SELECT id FROM classes ORDER BY id ASC LIMIT 1');
    await db.run(
      `INSERT INTO students (name, class_id, username, created_at, is_active) VALUES (?, ?, ?, ?, 1)`,
      ['默认学生', firstClass?.id ?? 1, 'default_student', dayjs().toISOString()]
    );
  }
};

const tableHasColumn = async (db: AppDatabase, tableName: string, columnName: string) => {
  const columns = await db.all<{ name: string }[]>(`PRAGMA table_info(${tableName})`);
  return columns.some((column) => column.name === columnName);
};

const migrateLegacyTables = async (db: AppDatabase) => {
  const checkinsHasStudentId = await tableHasColumn(db, 'checkins', 'student_id');
  const logsHasStudentId = await tableHasColumn(db, 'study_logs', 'student_id');

  if (!checkinsHasStudentId) {
    await db.exec('DROP TABLE IF EXISTS checkins;');
    await db.exec(`
      CREATE TABLE checkins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        plan_date TEXT NOT NULL,
        student_id INTEGER NOT NULL,
        streak INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE (plan_date, student_id),
        FOREIGN KEY (student_id) REFERENCES students(id)
      );
    `);
  }

  if (!logsHasStudentId) {
    await db.exec('DROP TABLE IF EXISTS study_logs;');
    await db.exec(`
      CREATE TABLE study_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        plan_date TEXT NOT NULL,
        student_id INTEGER NOT NULL,
        word_id INTEGER NOT NULL,
        activity TEXT NOT NULL,
        is_correct INTEGER NOT NULL,
        duration_sec INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        FOREIGN KEY (student_id) REFERENCES students(id),
        FOREIGN KEY (word_id) REFERENCES words(id)
      );
    `);
  }
};

const getOrCreateStudentProgress = async (db: AppDatabase, studentId: number, wordId: number) => {
  const existing = await db.get<{ word_id: number }>(
    `SELECT word_id FROM student_word_progress WHERE student_id = ? AND word_id = ?`,
    [studentId, wordId]
  );

  if (!existing) {
    await db.run(
      `
      INSERT INTO student_word_progress (
        student_id,
        word_id,
        due_date,
        interval_days,
        ease_factor,
        repetitions,
        lapses,
        times_seen,
        times_correct,
        last_reviewed_at,
        last_result
      ) VALUES (?, ?, ?, 1, 2.5, 0, 0, 0, 0, NULL, NULL)
      `,
      [studentId, wordId, dayjs().format('YYYY-MM-DD')]
    );
  }
};

const buildSpellingHint = (targetWord: string, answer: string) => {
  const target = normalizeSpelling(targetWord);
  const typed = normalizeSpelling(answer);

  if (target === typed) {
    return {
      distance: 0,
      firstMismatchIndex: -1,
      hint: '拼写正确'
    };
  }

  let firstMismatchIndex = -1;
  const minLen = Math.min(target.length, typed.length);
  for (let i = 0; i < minLen; i += 1) {
    if (target[i] !== typed[i]) {
      firstMismatchIndex = i;
      break;
    }
  }

  if (firstMismatchIndex === -1) {
    firstMismatchIndex = minLen;
  }

  let hint = '';
  if (typed.length < target.length) {
    hint = `少写了字母，建议检查第 ${firstMismatchIndex + 1} 位之后`;
  } else if (typed.length > target.length) {
    hint = `多写了字母，建议从第 ${firstMismatchIndex + 1} 位开始回看`;
  } else {
    const expected = target[firstMismatchIndex] ?? '';
    hint = `第 ${firstMismatchIndex + 1} 位建议改为 '${expected}'`;
  }

  const roughDistance = Math.abs(target.length - typed.length) +
    [...target].filter((char, idx) => typed[idx] !== char).length;

  return {
    distance: roughDistance,
    firstMismatchIndex,
    hint
  };
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
      audio_url TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS classes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      grade TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      class_id INTEGER NOT NULL,
      username TEXT UNIQUE NOT NULL,
      created_at TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (class_id) REFERENCES classes(id)
    );

    CREATE TABLE IF NOT EXISTS student_word_progress (
      student_id INTEGER NOT NULL,
      word_id INTEGER NOT NULL,
      due_date TEXT NOT NULL,
      interval_days INTEGER NOT NULL DEFAULT 1,
      ease_factor REAL NOT NULL DEFAULT 2.5,
      repetitions INTEGER NOT NULL DEFAULT 0,
      lapses INTEGER NOT NULL DEFAULT 0,
      times_seen INTEGER NOT NULL DEFAULT 0,
      times_correct INTEGER NOT NULL DEFAULT 0,
      last_reviewed_at TEXT,
      last_result TEXT,
      PRIMARY KEY (student_id, word_id),
      FOREIGN KEY (student_id) REFERENCES students(id),
      FOREIGN KEY (word_id) REFERENCES words(id)
    );

    CREATE TABLE IF NOT EXISTS student_daily_plans (
      plan_date TEXT NOT NULL,
      student_id INTEGER NOT NULL,
      total_words INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (plan_date, student_id),
      FOREIGN KEY (student_id) REFERENCES students(id)
    );

    CREATE TABLE IF NOT EXISTS student_daily_plan_words (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_date TEXT NOT NULL,
      student_id INTEGER NOT NULL,
      word_id INTEGER NOT NULL,
      order_index INTEGER NOT NULL,
      reading_done INTEGER NOT NULL DEFAULT 0,
      spelling_done INTEGER NOT NULL DEFAULT 0,
      spelling_attempts INTEGER NOT NULL DEFAULT 0,
      spelling_correct INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      UNIQUE(plan_date, student_id, word_id),
      FOREIGN KEY (student_id) REFERENCES students(id),
      FOREIGN KEY (word_id) REFERENCES words(id)
    );

    CREATE TABLE IF NOT EXISTS checkins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_date TEXT NOT NULL,
      student_id INTEGER NOT NULL,
      streak INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE (plan_date, student_id),
      FOREIGN KEY (student_id) REFERENCES students(id)
    );

    CREATE TABLE IF NOT EXISTS study_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_date TEXT NOT NULL,
      student_id INTEGER NOT NULL,
      word_id INTEGER NOT NULL,
      activity TEXT NOT NULL,
      is_correct INTEGER NOT NULL,
      duration_sec INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (student_id) REFERENCES students(id),
      FOREIGN KEY (word_id) REFERENCES words(id)
    );

  `);

  await migrateLegacyTables(dbInstance);
  await dbInstance.exec('CREATE INDEX IF NOT EXISTS idx_swp_due_date ON student_word_progress(student_id, due_date);');
  await dbInstance.exec('CREATE INDEX IF NOT EXISTS idx_sdpw_date ON student_daily_plan_words(plan_date, student_id);');
  await dbInstance.exec('CREATE INDEX IF NOT EXISTS idx_study_logs ON study_logs(plan_date, student_id, activity);');

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

  await ensureDefaultAccounts(dbInstance);

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

const chooseWordsForPlan = async (db: AppDatabase, studentId: number, planDate: string, targetSize: number) => {
  const dueRows = await db.all<{ id: number }[]>(
    `
    SELECT w.id
    FROM student_word_progress p
    JOIN words w ON w.id = p.word_id
    WHERE p.student_id = ?
      AND p.due_date <= ?
    ORDER BY p.due_date ASC, p.repetitions ASC, (p.times_seen - p.times_correct) DESC
    LIMIT ?
    `,
    [studentId, planDate, targetSize]
  );

  const selected = dueRows.map((item) => item.id);
  const remain = targetSize - selected.length;

  if (remain > 0) {
    const placeholders = selected.length > 0 ? selected.map(() => '?').join(',') : '';
    const excludeSql = selected.length > 0 ? `AND w.id NOT IN (${placeholders})` : '';

    const unseenRows = await db.all<{ id: number }[]>(
      `
      SELECT w.id
      FROM words w
      LEFT JOIN student_word_progress p
        ON p.word_id = w.id AND p.student_id = ?
      WHERE p.word_id IS NULL
      ${excludeSql}
      ORDER BY RANDOM()
      LIMIT ?
      `,
      selected.length > 0 ? [studentId, ...selected, remain] : [studentId, remain]
    );

    selected.push(...unseenRows.map((item) => item.id));
  }

  return selected.slice(0, targetSize);
};

export const ensureDailyPlan = async (planDate: string, studentId: number, targetSize = 30) => {
  const db = await getDb();
  const existing = await db.get<{ plan_date: string }>(
    'SELECT plan_date FROM student_daily_plans WHERE plan_date = ? AND student_id = ?',
    [planDate, studentId]
  );

  if (!existing) {
    const now = dayjs().toISOString();
    await db.run(
      'INSERT INTO student_daily_plans (plan_date, student_id, total_words, created_at) VALUES (?, ?, ?, ?)',
      [planDate, studentId, targetSize, now]
    );

    const selectedIds = await chooseWordsForPlan(db, studentId, planDate, targetSize);

    let order = 1;
    for (const wordId of selectedIds) {
      await getOrCreateStudentProgress(db, studentId, wordId);
      await db.run(
        `
        INSERT INTO student_daily_plan_words (plan_date, student_id, word_id, order_index, created_at)
        VALUES (?, ?, ?, ?, ?)
        `,
        [planDate, studentId, wordId, order, now]
      );
      order += 1;
    }
  }

  const rows = await db.all<PlanWord[]>(
    `
    SELECT
      w.id,
      w.word,
      w.phonetic,
      w.meaning,
      w.level,
      w.category,
      w.audio_url AS audioUrl,
      p.reading_done AS readingDone,
      p.spelling_done AS spellingDone,
      p.spelling_attempts AS spellingAttempts,
      p.spelling_correct AS spellingCorrect
    FROM student_daily_plan_words p
    JOIN words w ON w.id = p.word_id
    WHERE p.plan_date = ? AND p.student_id = ?
    ORDER BY p.order_index ASC
    `,
    [planDate, studentId]
  );

  return rows.map((item) => ({
    ...item,
    readingDone: Boolean(item.readingDone),
    spellingDone: Boolean(item.spellingDone),
    spellingCorrect: Boolean(item.spellingCorrect)
  }));
};

export const markReadingDone = async (planDate: string, studentId: number, wordId: number, durationSec: number) => {
  const db = await getDb();
  const now = dayjs().toISOString();

  await getOrCreateStudentProgress(db, studentId, wordId);

  await db.run(
    `
    UPDATE student_daily_plan_words
    SET reading_done = 1
    WHERE plan_date = ? AND student_id = ? AND word_id = ?
    `,
    [planDate, studentId, wordId]
  );

  await db.run(
    `
    INSERT INTO study_logs (plan_date, student_id, word_id, activity, is_correct, duration_sec, created_at)
    VALUES (?, ?, ?, 'reading', 1, ?, ?)
    `,
    [planDate, studentId, wordId, durationSec, now]
  );

  await db.run(
    `
    UPDATE student_word_progress
    SET times_seen = times_seen + 1,
        last_reviewed_at = ?
    WHERE student_id = ? AND word_id = ?
    `,
    [now, studentId, wordId]
  );
};

export const markSpelling = async (planDate: string, studentId: number, wordId: number, answer: string, durationSec: number) => {
  const db = await getDb();
  const now = dayjs().toISOString();
  const target = await db.get<{ word: string }>('SELECT word FROM words WHERE id = ?', [wordId]);
  if (!target) {
    throw new Error('Word not found');
  }

  await getOrCreateStudentProgress(db, studentId, wordId);

  const isCorrect = normalizeSpelling(target.word) === normalizeSpelling(answer);
  const hintDetail = buildSpellingHint(target.word, answer);

  await db.run(
    `
    UPDATE student_daily_plan_words
    SET spelling_done = CASE WHEN ? = 1 THEN 1 ELSE spelling_done END,
        spelling_attempts = spelling_attempts + 1,
        spelling_correct = CASE WHEN ? = 1 THEN 1 ELSE spelling_correct END
    WHERE plan_date = ? AND student_id = ? AND word_id = ?
    `,
    [isCorrect ? 1 : 0, isCorrect ? 1 : 0, planDate, studentId, wordId]
  );

  await db.run(
    `
    INSERT INTO study_logs (plan_date, student_id, word_id, activity, is_correct, duration_sec, created_at)
    VALUES (?, ?, ?, 'spelling', ?, ?, ?)
    `,
    [planDate, studentId, wordId, isCorrect ? 1 : 0, durationSec, now]
  );

  const progress = await db.get<{
    interval_days: number;
    ease_factor: number;
    repetitions: number;
    lapses: number;
  }>(
    `
    SELECT interval_days, ease_factor, repetitions, lapses
    FROM student_word_progress
    WHERE student_id = ? AND word_id = ?
    `,
    [studentId, wordId]
  );

  const currentInterval = progress?.interval_days ?? 1;
  const currentEase = progress?.ease_factor ?? 2.5;
  const currentRep = progress?.repetitions ?? 0;
  const currentLapses = progress?.lapses ?? 0;

  let nextInterval = 1;
  let nextEase = currentEase;
  let nextRep = currentRep;
  let nextLapses = currentLapses;
  let nextResult = 'wrong';

  if (isCorrect) {
    if (currentRep <= 0) {
      nextInterval = 1;
    } else if (currentRep === 1) {
      nextInterval = 3;
    } else {
      nextInterval = Math.max(1, Math.round(currentInterval * currentEase));
    }
    nextEase = Math.min(3.0, currentEase + 0.08);
    nextRep = currentRep + 1;
    nextResult = 'correct';
  } else {
    nextInterval = 1;
    nextEase = Math.max(1.3, currentEase - 0.2);
    nextRep = 0;
    nextLapses = currentLapses + 1;
  }

  const dueDate = dayjs(planDate).add(nextInterval, 'day').format('YYYY-MM-DD');

  await db.run(
    `
    UPDATE student_word_progress
    SET times_seen = times_seen + 1,
        times_correct = times_correct + ?,
        interval_days = ?,
        ease_factor = ?,
        repetitions = ?,
        lapses = ?,
        due_date = ?,
        last_reviewed_at = ?,
        last_result = ?
    WHERE student_id = ? AND word_id = ?
    `,
    [isCorrect ? 1 : 0, nextInterval, nextEase, nextRep, nextLapses, dueDate, now, nextResult, studentId, wordId]
  );

  return {
    isCorrect,
    target: target.word,
    hint: hintDetail.hint,
    firstMismatchIndex: hintDetail.firstMismatchIndex,
    distance: hintDetail.distance
  };
};

export const createCheckinIfEligible = async (planDate: string, studentId: number) => {
  const db = await getDb();
  const progress = await db.get<{ total: number; done: number }>(
    `
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN reading_done = 1 AND spelling_done = 1 THEN 1 ELSE 0 END) AS done
    FROM student_daily_plan_words
    WHERE plan_date = ? AND student_id = ?
    `,
    [planDate, studentId]
  );

  const total = progress?.total ?? 0;
  const done = progress?.done ?? 0;

  if (total === 0 || done < total) {
    return { success: false, message: '请先完成当日30词跟读和默写' };
  }

  const existing = await db.get<{ streak: number }>(
    'SELECT streak FROM checkins WHERE plan_date = ? AND student_id = ?',
    [planDate, studentId]
  );

  if (existing) {
    return { success: true, streak: existing.streak, message: '今日已打卡' };
  }

  const yesterday = dayjs(planDate).subtract(1, 'day').format('YYYY-MM-DD');
  const yesterdayCheckin = await db.get<{ streak: number }>(
    'SELECT streak FROM checkins WHERE plan_date = ? AND student_id = ?',
    [yesterday, studentId]
  );
  const streak = (yesterdayCheckin?.streak ?? 0) + 1;

  await db.run(
    'INSERT INTO checkins (plan_date, student_id, streak, created_at) VALUES (?, ?, ?, ?)',
    [planDate, studentId, streak, dayjs().toISOString()]
  );

  return { success: true, streak, message: '打卡成功' };
};

export const getOverviewStats = async (rangeDays: number, studentId: number) => {
  const db = await getDb();
  const safeRange = Number.isFinite(rangeDays) ? Math.max(7, Math.min(rangeDays, 120)) : 30;
  const fromDate = dayjs().subtract(safeRange - 1, 'day').format('YYYY-MM-DD');

  const [wordStats, streakRow, todayCompletion, progressRows, accuracyRows, weakRows] = await Promise.all([
    db.get<{ total: number; learned: number; mastered: number }>(
      `
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN p.times_seen > 0 THEN 1 ELSE 0 END) AS learned,
        SUM(CASE WHEN p.times_seen >= 3 AND CAST(p.times_correct AS REAL) / p.times_seen >= 0.8 THEN 1 ELSE 0 END) AS mastered
      FROM words w
      LEFT JOIN student_word_progress p ON p.word_id = w.id AND p.student_id = ?
      `,
      [studentId]
    ),
    db.get<{ streak: number }>(
      'SELECT streak FROM checkins WHERE student_id = ? ORDER BY plan_date DESC LIMIT 1',
      [studentId]
    ),
    db.get<{ total: number; done: number }>(
      `
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN reading_done = 1 AND spelling_done = 1 THEN 1 ELSE 0 END) AS done
      FROM student_daily_plan_words
      WHERE plan_date = ? AND student_id = ?
      `,
      [dayjs().format('YYYY-MM-DD'), studentId]
    ),
    db.all<{ planDate: string; completed: number; total: number }[]>(
      `
      SELECT
        dp.plan_date AS planDate,
        SUM(CASE WHEN dpw.reading_done = 1 AND dpw.spelling_done = 1 THEN 1 ELSE 0 END) AS completed,
        COUNT(*) AS total
      FROM student_daily_plans dp
      LEFT JOIN student_daily_plan_words dpw
        ON dpw.plan_date = dp.plan_date AND dpw.student_id = dp.student_id
      WHERE dp.plan_date >= ? AND dp.student_id = ?
      GROUP BY dp.plan_date
      ORDER BY dp.plan_date ASC
      `,
      [fromDate, studentId]
    ),
    db.all<{ planDate: string; accuracy: number }[]>(
      `
      SELECT
        plan_date AS planDate,
        ROUND(100.0 * SUM(CASE WHEN activity = 'spelling' AND is_correct = 1 THEN 1 ELSE 0 END) /
          NULLIF(SUM(CASE WHEN activity = 'spelling' THEN 1 ELSE 0 END), 0), 2) AS accuracy
      FROM study_logs
      WHERE plan_date >= ? AND student_id = ?
      GROUP BY plan_date
      ORDER BY plan_date ASC
      `,
      [fromDate, studentId]
    ),
    db.all<{ word: string; meaning: string; accuracy: number; seen: number }[]>(
      `
      SELECT
        w.word,
        w.meaning,
        ROUND(100.0 * p.times_correct / NULLIF(p.times_seen, 0), 2) AS accuracy,
        p.times_seen AS seen
      FROM student_word_progress p
      JOIN words w ON w.id = p.word_id
      WHERE p.student_id = ? AND p.times_seen >= 2
      ORDER BY (p.times_seen - p.times_correct) DESC, accuracy ASC
      LIMIT 10
      `,
      [studentId]
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

export const getWordLibrary = async (query: string | undefined, level: string | undefined, studentId: number) => {
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
      w.id,
      w.word,
      w.phonetic,
      w.meaning,
      w.level,
      w.category,
      w.audio_url AS audioUrl,
      COALESCE(p.times_seen, 0) AS timesSeen,
      CASE WHEN COALESCE(p.times_seen, 0) = 0 THEN NULL
           ELSE ROUND(100.0 * p.times_correct / p.times_seen, 2) END AS accuracy
    FROM words w
    LEFT JOIN student_word_progress p ON p.word_id = w.id AND p.student_id = ?
    WHERE (? = '' OR w.word LIKE '%' || ? || '%' OR w.meaning LIKE '%' || ? || '%')
      AND (? = '' OR w.level = ?)
    ORDER BY w.level ASC, w.word ASC
    `,
    [studentId, keyword, keyword, keyword, level ?? '', level ?? '']
  );

  return rows;
};

export const getWrongWordList = async (limit = 80, studentId = 1) => {
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
      w.id,
      w.word,
      w.phonetic,
      w.meaning,
      w.level,
      w.category,
      p.times_seen AS timesSeen,
      p.times_correct AS timesCorrect,
      (p.times_seen - p.times_correct) AS wrongCount,
      ROUND(100.0 * p.times_correct / NULLIF(p.times_seen, 0), 2) AS accuracy,
      p.last_reviewed_at AS lastReviewedAt
    FROM student_word_progress p
    JOIN words w ON w.id = p.word_id
    WHERE p.student_id = ?
      AND p.times_seen >= 3
      AND (p.times_seen - p.times_correct) >= 1
    ORDER BY wrongCount DESC, accuracy ASC, timesSeen DESC
    LIMIT ?
    `,
    [studentId, safeLimit]
  );

  return rows;
};

export const getAccountsBootstrap = async () => {
  const db = await getDb();
  const classes = await db.all<{ id: number; name: string; grade: string }[]>(
    'SELECT id, name, grade FROM classes ORDER BY id ASC'
  );
  const students = await db.all<{ id: number; name: string; classId: number; username: string; isActive: number }[]>(
    `
    SELECT id, name, class_id AS classId, username, is_active AS isActive
    FROM students
    ORDER BY id ASC
    `
  );

  return {
    classes,
    students,
    defaultStudentId: students[0]?.id ?? null
  };
};

export const createClassroom = async (name: string, grade: string) => {
  const db = await getDb();
  const result = await db.run(
    'INSERT INTO classes (name, grade, created_at) VALUES (?, ?, ?)',
    [name, grade, dayjs().toISOString()]
  );
  return {
    id: result.lastID,
    name,
    grade
  };
};

export const createStudent = async (name: string, classId: number, username: string) => {
  const db = await getDb();
  const result = await db.run(
    'INSERT INTO students (name, class_id, username, created_at, is_active) VALUES (?, ?, ?, ?, 1)',
    [name, classId, username, dayjs().toISOString()]
  );

  return {
    id: result.lastID,
    name,
    classId,
    username,
    isActive: 1
  };
};

const getPeriodRange = (period: 'weekly' | 'monthly') => {
  const end = dayjs();
  const start = period === 'weekly' ? end.subtract(6, 'day') : end.subtract(29, 'day');
  return {
    start: start.format('YYYY-MM-DD'),
    end: end.format('YYYY-MM-DD')
  };
};

export const getReportSummary = async (studentId: number, period: 'weekly' | 'monthly') => {
  const db = await getDb();
  const { start, end } = getPeriodRange(period);

  const [student, checkins, spellings, readings, wrongTop] = await Promise.all([
    db.get<{ name: string; className: string }>(
      `
      SELECT s.name, c.name AS className
      FROM students s
      JOIN classes c ON c.id = s.class_id
      WHERE s.id = ?
      `,
      [studentId]
    ),
    db.get<{ days: number }>(
      `
      SELECT COUNT(*) AS days
      FROM checkins
      WHERE student_id = ? AND plan_date BETWEEN ? AND ?
      `,
      [studentId, start, end]
    ),
    db.get<{ total: number; correct: number }>(
      `
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) AS correct
      FROM study_logs
      WHERE student_id = ?
        AND activity = 'spelling'
        AND plan_date BETWEEN ? AND ?
      `,
      [studentId, start, end]
    ),
    db.get<{ total: number }>(
      `
      SELECT COUNT(*) AS total
      FROM study_logs
      WHERE student_id = ?
        AND activity = 'reading'
        AND plan_date BETWEEN ? AND ?
      `,
      [studentId, start, end]
    ),
    db.all<{ word: string; wrongCount: number }[]>(
      `
      SELECT
        w.word,
        (p.times_seen - p.times_correct) AS wrongCount
      FROM student_word_progress p
      JOIN words w ON w.id = p.word_id
      WHERE p.student_id = ?
      ORDER BY wrongCount DESC
      LIMIT 5
      `,
      [studentId]
    )
  ]);

  const spellingTotal = spellings?.total ?? 0;
  const spellingCorrect = spellings?.correct ?? 0;

  return {
    studentName: student?.name ?? '未知学生',
    className: student?.className ?? '未知班级',
    period,
    startDate: start,
    endDate: end,
    checkinDays: checkins?.days ?? 0,
    readingCount: readings?.total ?? 0,
    spellingCount: spellingTotal,
    spellingAccuracy: spellingTotal > 0 ? Number(((spellingCorrect / spellingTotal) * 100).toFixed(2)) : 0,
    topWrongWords: wrongTop
  };
};

export const exportReportCsv = async (studentId: number, period: 'weekly' | 'monthly') => {
  const summary = await getReportSummary(studentId, period);

  const lines = [
    '字段,值',
    `学生,${summary.studentName}`,
    `班级,${summary.className}`,
    `周期,${period}`,
    `起始日期,${summary.startDate}`,
    `结束日期,${summary.endDate}`,
    `打卡天数,${summary.checkinDays}`,
    `跟读次数,${summary.readingCount}`,
    `默写次数,${summary.spellingCount}`,
    `默写正确率,${summary.spellingAccuracy}%`,
    '',
    '高频错词,错误次数',
    ...summary.topWrongWords.map((row) => `${row.word},${row.wrongCount}`)
  ];

  return lines.join('\n');
};
