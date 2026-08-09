"use client";

import { useState } from "react";
import Link from "next/link";
import { addOrGetWord, type Word } from "@/lib/db";

export default function NewWordPage() {
  const [word, setWord] = useState("");
  const [sentence, setSentence] = useState("");
  const [commonMistake, setCommonMistake] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedWord, setSavedWord] = useState<Word | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const result = await addOrGetWord({ word, sentence, commonMistake });
      setSavedWord(result);
      setWord("");
      setSentence("");
      setCommonMistake("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  if (savedWord) {
    return (
      <div className="mx-auto max-w-xl space-y-6">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
          <p className="text-2xl">🎉</p>
          <h1 className="mt-2 text-xl font-bold text-emerald-900">
            {savedWord.word} is now in your list
          </h1>
          <p className="mt-1 text-sm text-emerald-700">
            {savedWord.sentence
              ? `Context: “${savedWord.sentence}”`
              : "Add a sentence next time to give it more context."}
          </p>
        </div>
        <div className="flex justify-center gap-3">
          <button
            onClick={() => setSavedWord(null)}
            className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50"
          >
            Log another word
          </button>
          <Link
            href="/quiz"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700"
          >
            Take a quiz →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
          Log a Word
        </h1>
        <p className="mt-1 text-zinc-500">
          Add a word you frequently misspell. We'll quiz you on it later.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm"
      >
        <div>
          <label htmlFor="word" className="mb-1 block text-sm font-medium text-zinc-700">
            Word <span className="text-rose-500">*</span>
          </label>
          <input
            id="word"
            type="text"
            required
            autoFocus
            value={word}
            onChange={(e) => setWord(e.target.value)}
            placeholder="e.g. necessary"
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 placeholder-zinc-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
        </div>

        <div>
          <label htmlFor="sentence" className="mb-1 block text-sm font-medium text-zinc-700">
            Example sentence <span className="text-zinc-400">(optional)</span>
          </label>
          <textarea
            id="sentence"
            rows={2}
            value={sentence}
            onChange={(e) => setSentence(e.target.value)}
            placeholder="e.g. It is necessary to double-check your work."
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 placeholder-zinc-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
        </div>

        <div>
          <label htmlFor="mistake" className="mb-1 block text-sm font-medium text-zinc-700">
            How you usually misspell it{" "}
            <span className="text-zinc-400">(optional)</span>
          </label>
          <input
            id="mistake"
            type="text"
            value={commonMistake}
            onChange={(e) => setCommonMistake(e.target.value)}
            placeholder="e.g. neccessary"
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 placeholder-zinc-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
        </div>

        {error && (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={saving || !word.trim()}
          className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save Word"}
        </button>
      </form>
    </div>
  );
}