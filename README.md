# 湖南省高中英语单词记背程序

一个面向湖南省高中英语词汇学习的全栈应用，支持每日 30 词学习闭环：跟读、默写、打卡、统计、可视化。

## 主要功能

- 完整词库结构（按教学模块字段分类：模块、词性、音标、释义）
- 每日 30 词计划自动生成
- 跟读训练（音频发音）+ 默写判定
- 班级/学生账号体系（支持切换学习账号）
- 默写错误字母级提示（首个错误位提示）
- 基于遗忘曲线思想的 SRS 调度（间隔、难度因子、到期复习）
- 打卡过关与连续打卡天数统计
- 学习进度看板：完成量趋势、默写正确率趋势、薄弱词 Top10
- 学习报告（周报/月报）与 CSV 导出

## 技术栈

- 前端：Vue 3 + TypeScript + Pinia + Vue Router + ECharts
- 后端：Node.js + Express + TypeScript
- 数据库：SQLite（本地持久化）
- 音频：有道词典发音接口（可替换）

## 项目结构

```text
.
├── backend
│   ├── data
│   │   └── vocabulary.db
│   └── src
│       ├── data
│       │   └── full-words.example.json
│       ├── db.ts
│       ├── seedWords.ts
│       └── server.ts
├── frontend
│   └── src
│       ├── components
│       ├── stores
│       ├── views
│       ├── api.ts
│       ├── router.ts
│       └── main.ts
└── package.json
```

## 快速开始

```bash
npm install
npm install --prefix backend
npm install --prefix frontend
npm run dev
```

- 前端默认地址：http://localhost:5173
- 后端默认地址：http://localhost:3001

## 生产构建

```bash
npm run build
npm run start
```

## 全量词库导入（推荐）

默认会使用 `backend/src/seedWords.ts` 的内置词表。

项目已内置“人教版高中英语词汇”导入脚本，会生成完整词表文件：

```bash
npm run import:pep --prefix backend
```

执行后会生成：

- `backend/src/data/full-words.json`

词条规模：约 3665 词。

词表来源：公开可访问的人教版高中词汇数据包（有道词典词书格式）。

如果你希望使用你自己的校本词表，也可以直接替换该文件。

格式参考 `backend/src/data/full-words.example.json`：

```json
[
	{
		"word": "abandon",
		"phonetic": "/əˈbændən/",
		"meaning": "放弃；遗弃",
		"level": "必修一",
		"category": "动词"
	}
]
```

数据库导入注意：

- 仅在数据库首次初始化时导入词表。
- 若你已启动过项目并生成过 `backend/data/vocabulary.db`，替换词表后需删除该数据库文件再重启后端，才能重新导入。

```bash
rm -f backend/data/vocabulary.db
npm run dev
```

## 核心 API

- `GET /api/accounts/bootstrap`：获取班级与学生账号
- `POST /api/classes`：创建班级
- `POST /api/students`：创建学生
- `GET /api/daily-plan?date=YYYY-MM-DD&studentId=1`：获取/生成当日 30 词
- `POST /api/daily-plan/:wordId/reading`：提交跟读完成（body 含 `date`、`studentId`）
- `POST /api/daily-plan/:wordId/spelling`：提交默写答案（返回 `hint`、`firstMismatchIndex`）
- `POST /api/checkin`：当日过关打卡（body 含 `date`、`studentId`）
- `GET /api/stats/overview?days=30&studentId=1`：学习统计看板
- `GET /api/words?query=&level=&studentId=1`：词库查询
- `GET /api/words/wrong?studentId=1`：错词本
- `GET /api/reports/summary?studentId=1&period=weekly|monthly`：学习报告摘要
- `GET /api/reports/export?studentId=1&period=weekly|monthly`：导出 CSV 报告

## 已完成扩展

- 接入账号体系（班级、学生）
- 默写评分细化（字母级错误提示）
- 复习算法升级（遗忘曲线/SRS）
- 导出学习报告（周报/月报）
