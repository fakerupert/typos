"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getAllWords, recordAttempt, type Word } from "@/lib/db";

type Phase = "loading" | "ready" | "playing" | "finished";

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z']/g, "");
}

/** Fisher–Yates shuffle so the quiz pulls from the entire word pool. */
function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export default function QuizPage() {
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<Phase>("loading");
  const [words, setWords] = useState<Word[]>([]);
  const [index, setIndex] = useState(0);
  const [guess, setGuess] = useState("");
  const [focused, setFocused] = useState(false);
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [score, setScore] = useState({ correct: 0, wrong: 0 });
  const [speechSupported, setSpeechSupported] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  // Increments on every new word spoken; stale sentence timeouts check it
  // before speaking so an old word's sentence can't play over the next word.
  const speechTokenRef = useRef(0);

  const current = words[index];

  useEffect(() => {
    setMounted(true);
    setSpeechSupported(
      typeof window !== "undefined" && "speechSynthesis" in window,
    );
  }, []);

  useEffect(() => {
    if (!mounted) return;
    let cancelled = false;
    (async () => {
      try {
        // Fetch ALL stored words unconditionally, then shuffle the full pool.
        const all = await getAllWords();
        if (!cancelled) {
          setWords(shuffle(all));
          setPhase(all.length > 0 ? "ready" : "finished");
        }
      } catch {
        // IndexedDB unavailable — show the empty state rather than spinning.
        if (!cancelled) setPhase("finished");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mounted]);

  const speak = useCallback((text: string) => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.85;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
  }, []);

  const speakWord = useCallback(
    (word: Word) => {
      if (!word) return;
      const token = ++speechTokenRef.current;
      speak(word.word);
      if (word.sentence) {
        // Speak the sentence after a short pause so the word is heard first.
        setTimeout(() => {
          if (speechTokenRef.current === token) {
            speak(word.sentence!);
          }
        }, 1200);
      }
    },
    [speak],
  );

  if (!mounted) {
    // Server render / first paint: render nothing database-dependent.
    return null;
  }

  function startQuiz() {
    setIndex(0);
    setScore({ correct: 0, wrong: 0 });
    setFeedback(null);
    setGuess("");
    setPhase("playing");
    const firstWord = words[0];
    setTimeout(() => {
      speakWord(firstWord);
      inputRef.current?.focus();
    }, 100);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!current || feedback) return;

    const isCorrect = normalize(guess) === normalize(current.word);
    void recordAttempt(current.id!, current.word, isCorrect);

    setFeedback(isCorrect ? "correct" : "wrong");
    setScore((s) => ({
      correct: s.correct + (isCorrect ? 1 : 0),
      wrong: s.wrong + (isCorrect ? 0 : 1),
    }));
  }

  function nextQuestion() {
    const next = index + 1;
    if (next >= words.length) {
      setPhase("finished");
      return;
    }
    setIndex(next);
    setGuess("");
    setFeedback(null);
    // Speak the explicit next word from the pool, NOT the closure's `current`,
    // so the voice always matches the question being shown.
    const nextWord = words[next];
    setTimeout(() => {
      speakWord(nextWord);
      inputRef.current?.focus();
    }, 100);
  }

  if (phase === "loading") {
    return (
      <div className="flex items-center justify-center py-24 text-zinc-400">
        Loading your words…
      </div>
    );
  }

  if (phase === "ready") {
    return (
      <div className="mx-auto max-w-xl space-y-6 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
          Spelling Quiz
        </h1>
        <p className="text-zinc-500">
          You have <span className="font-semibold text-zinc-800">{words.length}</span>{" "}
          word{words.length === 1 ? "" : "s"} to practice. We'll read each
          one aloud — type what you hear.
        </p>
        {!speechSupported && (
          <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Your browser doesn't support speech synthesis. You'll see
            the word to spell instead.
          </p>
        )}
        <button
          onClick={startQuiz}
          className="rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700"
        >
          Start Quiz
        </button>
      </div>
    );
  }

  if (phase === "finished") {
    const total = score.correct + score.wrong;
    const pct = total ? Math.round((score.correct / total) * 100) : 0;
    return (
      <div className="mx-auto max-w-xl space-y-6 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
          {words.length === 0 ? "Nothing to practice" : "Quiz Complete!"}
        </h1>
        {words.length === 0 ? (
          <>
            <p className="text-zinc-500">
              You don't have any words that need practice yet. Log a word
              you often misspell to get started.
            </p>
            <Link
              href="/words/new"
              className="inline-block rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700"
            >
              Log a Word
            </Link>
          </>
        ) : (
          <>
            <div className="rounded-xl border border-zinc-200 bg-white p-8 shadow-sm">
              <p className="text-5xl font-bold text-indigo-600">{pct}%</p>
              <p className="mt-2 text-zinc-500">
                {score.correct} correct · {score.wrong} missed
              </p>
            </div>
            <div className="flex justify-center gap-3">
              <button
                onClick={startQuiz}
                className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50"
              >
                Practice again
              </button>
              <Link
                href="/"
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700"
              >
                Back to Dashboard
              </Link>
            </div>
          </>
        )}
      </div>
    );
  }

  // playing
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
          Spelling Quiz
        </h1>
        <span className="text-sm font-medium text-zinc-500">
          {index + 1} / {words.length}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-2 overflow-hidden rounded-full bg-zinc-200">
        <div
          className="h-full rounded-full bg-indigo-600 transition-all"
          style={{ width: `${((index + (feedback ? 1 : 0)) / words.length) * 100}%` }}
        />
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
        <button
          onClick={() => speakWord(current)}
          className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-indigo-600 text-3xl text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
          aria-label="Play word"
          title="Play word"
        >
          🔊
        </button>
        <p className="mt-4 text-sm text-zinc-500">
          {speechSupported
            ? "Click the speaker to hear the word again"
            : "Type the word shown below"}
        </p>
        {!speechSupported && (
          <p className="mt-2 text-2xl font-bold text-zinc-800">{current.word}</p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Stealth password input: Gboard treats a type="password" field as
            secure, so no prediction strip appears. The visible box below
            mirrors whatever the user types, in plaintext. */}
        <div
          className={`relative w-full cursor-text rounded-lg border px-4 py-3 text-center text-lg text-zinc-900 transition-colors focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-200 ${
            feedback ? "border-zinc-200 bg-zinc-50" : "border-zinc-300 bg-white"
          }`}
          onClick={() => {
            if (!feedback) inputRef.current?.focus();
          }}
        >
          <input
            ref={inputRef}
            type="password"
            value={guess}
            onChange={(e) => setGuess(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            disabled={!!feedback}
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            autoComplete="off"
            aria-label="Type your spelling guess"
            className="absolute inset-0 h-full w-full cursor-text rounded-lg opacity-0"
          />
          {guess ? (
            <span className="break-all">
              {guess}
              {focused && !feedback && (
                <span className="ml-0.5 inline-block h-5 w-0.5 animate-pulse bg-zinc-800 align-middle" />
              )}
            </span>
          ) : (
            <span className={feedback ? "text-zinc-300" : "text-zinc-400"}>
              {feedback
                ? feedback === "correct"
                  ? "Correct!"
                  : "Missed — see the answer above"
                : "Type the word you heard…"}
            </span>
          )}
        </div>

        {feedback && (
          <div
            className={`rounded-lg px-4 py-3 text-center text-sm font-medium ${
              feedback === "correct"
                ? "bg-emerald-50 text-emerald-800"
                : "bg-rose-50 text-rose-800"
            }`}
          >
            {feedback === "correct" ? (
              <>Correct! Nice spelling.</>
            ) : (
              <>
                The correct spelling is{" "}
                <span className="font-bold">{current.word}</span>
                {current.commonMistake && (
                  <>
                    {" "}
                    (you wrote “{guess}”)
                  </>
                )}
              </>
            )}
          </div>
        )}

        {!feedback ? (
          <button
            type="submit"
            disabled={!guess.trim()}
            className="w-full rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Check Answer
          </button>
        ) : (
          <button
            type="button"
            onClick={nextQuestion}
            className="w-full rounded-lg bg-zinc-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-zinc-800"
          >
            {index + 1 >= words.length ? "See Results" : "Next Word →"}
          </button>
        )}
      </form>
    </div>
  );
}