import Dexie, { type EntityTable } from "dexie";

export interface Word {
  id?: number;
  word: string;
  sentence?: string;
  commonMistake?: string;
  correctCount: number;
  wrongCount: number;
  createdAt: number;
  lastPracticedAt: number | null;
}

export interface PracticeLog {
  id?: number;
  wordId: number;
  word: string;
  isCorrect: boolean;
  at: number;
}

class TyposDatabase extends Dexie {
  words!: EntityTable<Word, "id">;
  practiceLogs!: EntityTable<PracticeLog, "id">;

  constructor() {
    super("typos-db");
    this.version(1).stores({
      words: "++id, &word, lastPracticedAt, createdAt",
      practiceLogs: "++id, wordId, at",
    });
  }
}

/** True when running in a browser environment where IndexedDB is available. */
export function isClient(): boolean {
  return typeof window !== "undefined" && typeof indexedDB !== "undefined";
}

let dbInstance: TyposDatabase | null = null;

/**
 * Lazily creates the Dexie database. Throws if called during server-side
 * rendering, where IndexedDB doesn't exist. All callers must only use this
 * inside client-side effects (useEffect / event handlers).
 */
export function getDb(): TyposDatabase {
  if (!isClient()) {
    throw new Error(
      "Dexie database cannot be accessed during server-side rendering. " +
        "Only call database functions from client-side code (e.g. inside useEffect).",
    );
  }
  if (!dbInstance) {
    dbInstance = new TyposDatabase();
  }
  return dbInstance;
}

export interface NewWordInput {
  word: string;
  sentence?: string;
  commonMistake?: string;
}

export async function addOrGetWord(input: NewWordInput): Promise<Word> {
  const db = getDb();
  const trimmedWord = input.word.trim().toLowerCase();
  if (!trimmedWord) throw new Error("Word cannot be empty");

  const existing = await db.words.where("word").equals(trimmedWord).first();

  if (existing) {
    // Enrich an existing entry with any newly provided context.
    await db.words.update(existing.id!, {
      ...(input.sentence?.trim() ? { sentence: input.sentence.trim() } : {}),
      ...(input.commonMistake?.trim() ? { commonMistake: input.commonMistake.trim() } : {}),
    });
    return (await db.words.get(existing.id!))!;
  }

  const id = await db.words.add({
    word: trimmedWord,
    sentence: input.sentence?.trim() || undefined,
    commonMistake: input.commonMistake?.trim() || undefined,
    correctCount: 0,
    wrongCount: 0,
    createdAt: Date.now(),
    lastPracticedAt: null,
  });

  return (await db.words.get(id))!;
}

export async function getAllWords(): Promise<Word[]> {
  const db = getDb();
  return db.words.orderBy("createdAt").reverse().toArray();
}

/** Words that are untested or have less than 80% accuracy. */
export async function getNeedsPracticeWords(): Promise<Word[]> {
  const db = getDb();
  const words = await db.words.orderBy("createdAt").reverse().toArray();
  return words.filter((w) => {
    const total = w.correctCount + w.wrongCount;
    if (total === 0) return true;
    return w.correctCount / total < 0.8;
  });
}

export async function recordAttempt(
  wordId: number,
  word: string,
  isCorrect: boolean,
): Promise<void> {
  const db = getDb();
  await db.transaction("rw", db.words, db.practiceLogs, async () => {
    const wordRecord = await db.words.get(wordId);
    if (wordRecord) {
      await db.words.update(wordId, {
        correctCount: wordRecord.correctCount + (isCorrect ? 1 : 0),
        wrongCount: wordRecord.wrongCount + (isCorrect ? 0 : 1),
        lastPracticedAt: Date.now(),
      });
    }
    await db.practiceLogs.add({ wordId, word, isCorrect, at: Date.now() });
  });
}

export interface DashboardStats {
  totalWords: number;
  totalAttempts: number;
  correctAttempts: number;
  accuracy: number; // percentage 0-100
  mastered: number;
  needsPractice: number;
}

export async function getStats(): Promise<DashboardStats> {
  const db = getDb();
  const [words, logs] = await Promise.all([
    db.words.orderBy("createdAt").reverse().toArray(),
    db.practiceLogs.toArray(),
  ]);

  const totalAttempts = logs.length;
  const correctAttempts = logs.filter((l) => l.isCorrect).length;

  const mastered = words.filter((w) => {
    const total = w.correctCount + w.wrongCount;
    return total >= 3 && w.correctCount / total >= 0.8;
  }).length;

  return {
    totalWords: words.length,
    totalAttempts,
    correctAttempts,
    accuracy: totalAttempts ? Math.round((correctAttempts / totalAttempts) * 100) : 0,
    mastered,
    needsPractice: words.length - mastered,
  };
}

export async function getRecentLogs(limit = 8): Promise<PracticeLog[]> {
  const db = getDb();
  return db.practiceLogs.orderBy("at").reverse().limit(limit).toArray();
}