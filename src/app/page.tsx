"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getStats, getRecentLogs, type DashboardStats, type PracticeLog } from "@/lib/db";

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-zinc-500">{label}</p>
      <p className={`mt-1 text-3xl font-bold ${accent ?? "text-zinc-900"}`}>
        {value}
      </p>
    </div>
  );
}

export default function DashboardPage() {
  const [mounted, setMounted] = useState(false);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentLogs, setRecentLogs] = useState<PracticeLog[]>([]);

  useEffect(() => {
    setMounted(true);
    let cancelled = false;
    (async () => {
      const [s, logs] = await Promise.all([getStats(), getRecentLogs()]);
      if (!cancelled) {
        setStats(s);
        setRecentLogs(logs);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!mounted) {
    // Server render / first paint: render nothing database-dependent.
    return null;
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center py-24 text-zinc-400">
        Loading…
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
            Dashboard
          </h1>
          <p className="mt-1 text-zinc-500">
            Track the words you struggle with and your practice progress.
          </p>
        </div>
        <Link
          href="/words/new"
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700"
        >
          + Log a Word
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Words Tracked" value={stats.totalWords} />
        <StatCard label="Attempts" value={stats.totalAttempts} />
        <StatCard
          label="Accuracy"
          value={`${stats.accuracy}%`}
          accent="text-indigo-600"
        />
        <StatCard
          label="Mastered"
          value={stats.mastered}
          accent="text-emerald-600"
        />
        <StatCard
          label="Needs Practice"
          value={stats.needsPractice}
          accent="text-amber-600"
        />
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900">Recent Activity</h2>
          <Link href="/quiz" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
            Start a quiz →
          </Link>
        </div>

        {recentLogs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-10 text-center">
            <p className="text-zinc-500">No practice yet.</p>
            <p className="mt-1 text-sm text-zinc-400">
              Log a word you often misspell, then take a quiz to get started.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
            {recentLogs.map((log) => (
              <li key={log.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <span
                    className={`inline-flex h-2.5 w-2.5 rounded-full ${
                      log.isCorrect ? "bg-emerald-500" : "bg-rose-500"
                    }`}
                  />
                  <span className="font-medium text-zinc-800">{log.word}</span>
                </div>
                <span
                  className={`text-sm font-semibold ${
                    log.isCorrect ? "text-emerald-600" : "text-rose-600"
                  }`}
                >
                  {log.isCorrect ? "Correct" : "Missed"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}