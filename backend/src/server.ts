import cors from 'cors';
import dayjs from 'dayjs';
import express from 'express';
import { z } from 'zod';
import {
  createClassroom,
  createCheckinIfEligible,
  createStudent,
  exportReportCsv,
  ensureDailyPlan,
  getAccountsBootstrap,
  getOverviewStats,
  getReportSummary,
  getWrongWordList,
  getWordLibrary,
  markReadingDone,
  markSpelling
} from './db';

const app = express();
const PORT = Number(process.env.PORT ?? 3001);

app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, date: dayjs().toISOString() });
});

app.get('/api/daily-plan', async (req, res) => {
  const date = (req.query.date as string | undefined) ?? dayjs().format('YYYY-MM-DD');
  const studentId = Number(req.query.studentId ?? 1);
  const words = await ensureDailyPlan(date, studentId, 20);

  const completed = words.filter((w) => w.readingDone && w.spellingDone).length;

  res.json({
    date,
    total: words.length,
    completed,
    words
  });
});

app.post('/api/daily-plan/:wordId/reading', async (req, res) => {
  const paramsSchema = z.object({
    wordId: z.coerce.number().int().positive()
  });
  const bodySchema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    studentId: z.number().int().positive(),
    durationSec: z.number().int().min(0).max(3600).default(10)
  });

  const { wordId } = paramsSchema.parse(req.params);
  const { date, studentId, durationSec } = bodySchema.parse(req.body);

  await markReadingDone(date, studentId, wordId, durationSec);
  res.json({ success: true });
});

app.post('/api/daily-plan/:wordId/spelling', async (req, res) => {
  const paramsSchema = z.object({
    wordId: z.coerce.number().int().positive()
  });
  const bodySchema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    studentId: z.number().int().positive(),
    answer: z.string().min(1),
    durationSec: z.number().int().min(0).max(3600).default(20)
  });

  const { wordId } = paramsSchema.parse(req.params);
  const { date, studentId, answer, durationSec } = bodySchema.parse(req.body);

  const result = await markSpelling(date, studentId, wordId, answer, durationSec);
  res.json({ success: true, ...result });
});

app.post('/api/checkin', async (req, res) => {
  const bodySchema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    studentId: z.number().int().positive()
  });

  const { date, studentId } = bodySchema.parse(req.body);
  const result = await createCheckinIfEligible(date, studentId);
  res.json(result);
});

app.get('/api/stats/overview', async (req, res) => {
  const daysRaw = Number(req.query.days ?? 30);
  const studentId = Number(req.query.studentId ?? 1);
  const data = await getOverviewStats(daysRaw, studentId);
  res.json(data);
});

app.get('/api/words', async (req, res) => {
  const query = (req.query.query as string | undefined) ?? '';
  const level = (req.query.level as string | undefined) ?? '';
  const studentId = Number(req.query.studentId ?? 1);
  const rows = await getWordLibrary(query, level, studentId);
  res.json(rows);
});

app.get('/api/words/wrong', async (req, res) => {
  const limit = Number(req.query.limit ?? 80);
  const studentId = Number(req.query.studentId ?? 1);
  const rows = await getWrongWordList(limit, studentId);
  res.json(rows);
});

app.get('/api/accounts/bootstrap', async (_req, res) => {
  const data = await getAccountsBootstrap();
  res.json(data);
});

app.post('/api/classes', async (req, res) => {
  const bodySchema = z.object({
    name: z.string().min(1),
    grade: z.string().min(1)
  });
  const payload = bodySchema.parse(req.body);
  const row = await createClassroom(payload.name, payload.grade);
  res.json(row);
});

app.post('/api/students', async (req, res) => {
  const bodySchema = z.object({
    name: z.string().min(1),
    classId: z.number().int().positive(),
    username: z.string().min(2)
  });
  const payload = bodySchema.parse(req.body);
  const row = await createStudent(payload.name, payload.classId, payload.username);
  res.json(row);
});

app.get('/api/reports/summary', async (req, res) => {
  const studentId = Number(req.query.studentId ?? 1);
  const period = (req.query.period as 'weekly' | 'monthly' | undefined) ?? 'weekly';
  const data = await getReportSummary(studentId, period === 'monthly' ? 'monthly' : 'weekly');
  res.json(data);
});

app.get('/api/reports/export', async (req, res) => {
  const studentId = Number(req.query.studentId ?? 1);
  const period = (req.query.period as 'weekly' | 'monthly' | undefined) ?? 'weekly';
  const normalized = period === 'monthly' ? 'monthly' : 'weekly';
  const csv = await exportReportCsv(studentId, normalized);

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${normalized}-report-student-${studentId}.csv"`);
  res.send(`\uFEFF${csv}`);
});

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err instanceof z.ZodError) {
    res.status(400).json({ message: '参数错误', details: err.flatten() });
    return;
  }

  console.error(err);
  res.status(500).json({ message: '服务器错误，请稍后重试' });
});

app.listen(PORT, () => {
  console.log(`API server running at http://localhost:${PORT}`);
});
