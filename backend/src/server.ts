import cors from 'cors';
import dayjs from 'dayjs';
import express from 'express';
import { z } from 'zod';
import {
  createCheckinIfEligible,
  ensureDailyPlan,
  getOverviewStats,
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
  const words = await ensureDailyPlan(date, 30);

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
    durationSec: z.number().int().min(0).max(3600).default(10)
  });

  const { wordId } = paramsSchema.parse(req.params);
  const { date, durationSec } = bodySchema.parse(req.body);

  await markReadingDone(date, wordId, durationSec);
  res.json({ success: true });
});

app.post('/api/daily-plan/:wordId/spelling', async (req, res) => {
  const paramsSchema = z.object({
    wordId: z.coerce.number().int().positive()
  });
  const bodySchema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    answer: z.string().min(1),
    durationSec: z.number().int().min(0).max(3600).default(20)
  });

  const { wordId } = paramsSchema.parse(req.params);
  const { date, answer, durationSec } = bodySchema.parse(req.body);

  const result = await markSpelling(date, wordId, answer, durationSec);
  res.json({ success: true, ...result });
});

app.post('/api/checkin', async (req, res) => {
  const bodySchema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
  });

  const { date } = bodySchema.parse(req.body);
  const result = await createCheckinIfEligible(date);
  res.json(result);
});

app.get('/api/stats/overview', async (req, res) => {
  const daysRaw = Number(req.query.days ?? 30);
  const data = await getOverviewStats(daysRaw);
  res.json(data);
});

app.get('/api/words', async (req, res) => {
  const query = (req.query.query as string | undefined) ?? '';
  const level = (req.query.level as string | undefined) ?? '';
  const rows = await getWordLibrary(query, level);
  res.json(rows);
});

app.get('/api/words/wrong', async (req, res) => {
  const limit = Number(req.query.limit ?? 80);
  const rows = await getWrongWordList(limit);
  res.json(rows);
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
