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

export type DailyPlanResponse = {
  date: string;
  total: number;
  completed: number;
  words: PlanWord[];
};

export type OverviewStats = {
  totalWords: number;
  learnedWords: number;
  masteredWords: number;
  currentStreak: number;
  today: {
    total: number;
    completed: number;
  };
  progressSeries: {
    planDate: string;
    completed: number;
    total: number;
  }[];
  accuracySeries: {
    planDate: string;
    accuracy: number;
  }[];
  weakWords: {
    word: string;
    meaning: string;
    accuracy: number;
    seen: number;
  }[];
};

export type LibraryWord = {
  id: number;
  word: string;
  phonetic: string;
  meaning: string;
  level: string;
  category: string;
  audioUrl: string;
  timesSeen: number;
  accuracy: number | null;
};

export type WrongWord = {
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
};
