import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKEND_ROOT = path.resolve(__dirname, '..');
const TMP_DIR = path.join(os.tmpdir(), 'pep_vocab_import');
const ZIP_PATH = path.join(TMP_DIR, 'GaoZhong_2.zip');
const RAW_JSON = path.join(TMP_DIR, 'GaoZhong_2.json');
const OUT_JSON = path.join(BACKEND_ROOT, 'src/data/full-words.json');

const SOURCE_URL = 'http://ydschool-online.nos.netease.com/1521164675301_GaoZhong_2.zip';

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

const toCategory = (raw) => {
  if (!raw) return '其他';
  if (raw.includes('n')) return '名词';
  if (raw.includes('v')) return '动词';
  if (raw.includes('adj')) return '形容词';
  if (raw.includes('adv')) return '副词';
  if (raw.includes('prep')) return '介词';
  if (raw.includes('pron')) return '代词';
  if (raw.includes('conj')) return '连词';
  if (raw.includes('int')) return '感叹词';
  return '其他';
};

const extractMeaning = (trans) => {
  if (!Array.isArray(trans) || trans.length === 0) return '';
  const first = trans[0];
  return (first?.tranCn || first?.tranOther || '').toString().trim();
};

ensureDir(TMP_DIR);
execSync(`curl -L -o "${ZIP_PATH}" "${SOURCE_URL}"`, { stdio: 'inherit' });
execSync(`unzip -o "${ZIP_PATH}" -d "${TMP_DIR}"`, { stdio: 'inherit' });

const lines = fs.readFileSync(RAW_JSON, 'utf8').split('\n').filter((line) => line.trim());
const seen = new Set();
const out = [];

for (const line of lines) {
  let item;
  try {
    item = JSON.parse(line);
  } catch {
    continue;
  }

  const headWord = item?.headWord?.toString().trim();
  if (!headWord) continue;

  const key = headWord.toLowerCase();
  if (seen.has(key)) continue;

  const wordContent = item?.content?.word?.content ?? {};
  const phonetic = (wordContent.ukphone || wordContent.usphone || '').toString().trim();
  const trans = wordContent.trans || [];
  const firstPos = (Array.isArray(trans) && trans.length > 0 ? trans[0]?.pos : '') || '';
  const meaning = extractMeaning(trans);

  out.push({
    word: headWord,
    phonetic: phonetic ? `/${phonetic}/` : '/-/',
    meaning: meaning || '（释义待补充）',
    level: '人教版高中词汇',
    category: toCategory(firstPos)
  });

  seen.add(key);
}

out.sort((a, b) => a.word.localeCompare(b.word));
ensureDir(path.dirname(OUT_JSON));
fs.writeFileSync(OUT_JSON, JSON.stringify(out, null, 2) + '\n', 'utf8');
console.log(`Generated ${out.length} entries at ${OUT_JSON}`);
