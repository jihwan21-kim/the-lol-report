"use client";

import { useMemo, useState } from "react";

export type AuditVote = {
  id: number;
  user: string;
  caption: string;
  value: string;
  timeMs: number | null;
  at: string;
};

type ReviewedVote = AuditVote & { reasons: string[] };
const positive = (v: AuditVote) => v.value === "funny" || v.value === "very funny";
const pct = (n: number, d: number) => d ? (100 * n / d).toFixed(1) + "%" : "—";
const shortId = (id: string) => id.length > 12 ? id.slice(0, 8) + "…" : id;
const dateText = (s: string) => Number.isFinite(Date.parse(s)) ? new Date(s).toLocaleString() : "Unknown";
const button = "rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium transition hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800";
const input = "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";

export function RealVoteAudit({ votes, studyId }: { votes: AuditVote[]; studyId: number }) {
  const [speed, setSpeed] = useState(1000);
  const [burst, setBurst] = useState(8);
  const [excluded, setExcluded] = useState<number[]>([]);
  const [filter, setFilter] = useState<"all" | "flagged" | "excluded">("flagged");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const excludedSet = useMemo(() => new Set(excluded), [excluded]);
  const analyzed = useMemo<ReviewedVote[]>(() => {
    const byUser = new Map<string, number[]>();
    for (const vote of votes) {
      const timestamp = Date.parse(vote.at);
      if (!Number.isFinite(timestamp)) continue;
      const times = byUser.get(vote.user) ?? [];
      times.push(timestamp);
      byUser.set(vote.user, times);
    }
    for (const times of byUser.values()) times.sort((a, b) => a - b);
    return votes.map(v => {
      const times = byUser.get(v.user) ?? [];
      const t = Date.parse(v.at);
      const count = Number.isFinite(t) ? times.filter(x => Math.abs(x - t) <= 30000).length : 0;
      const reasons = [
        ...(v.timeMs !== null && v.timeMs >= 0 && v.timeMs < speed ? ["Fast response"] : []),
        ...(count >= burst ? ["High frequency"] : []),
      ];
      return { ...v, reasons };
    });
  }, [votes, speed, burst]);
  const flagged = analyzed.filter(v => v.reasons.length > 0);
  const reviewed = analyzed.filter(v => !excludedSet.has(v.id));
  const originalPositive = analyzed.filter(positive).length;
  const reviewedPositive = reviewed.filter(positive).length;
  const originalRate = analyzed.length ? 100 * originalPositive / analyzed.length : null;
  const reviewedRate = reviewed.length ? 100 * reviewedPositive / reviewed.length : null;
  const delta = originalRate !== null && reviewedRate !== null ? reviewedRate - originalRate : null;
  const filtered = analyzed.filter(v => {
    if (filter === "flagged" && !v.reasons.length) return false;
    if (filter === "excluded" && !excludedSet.has(v.id)) return false;
    const q = search.trim().toLowerCase();
    return !q || [String(v.id), v.user, v.caption, v.value].some(s => s.toLowerCase().includes(q));
  });
  const pageSize = 20;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages - 1);
  const visible = filtered.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  const setTab = (next: "all" | "flagged" | "excluded") => { setFilter(next); setPage(0); };
  const toggle = (id: number) => setExcluded(old => old.includes(id) ? old.filter(x => x !== id) : [...old, id]);
  const metric = (label: string, value: string | number, detail: string, accent = false) => (
    <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`mt-2 text-3xl font-semibold tracking-tight ${accent ? "text-amber-600 dark:text-amber-400" : "text-slate-950 dark:text-white"}`}>{value}</p>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{detail}</p>
    </div>
  );

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 dark:bg-slate-950 dark:text-slate-100 sm:px-8">
      <div className="mx-auto max-w-7xl space-y-7">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">Research dashboard / Study {studyId}</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Vote integrity</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-500 dark:text-slate-400">Spot unusual voting, review individual records, and compare results before and after exclusions.</p>
          </div>
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">Study #{studyId} · Live database</span>
        </header>

        <section aria-label="Overview" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {metric("Total votes", analyzed.length, "All recorded votes")}
          {metric("Needs review", flagged.length, pct(flagged.length, analyzed.length) + " of total", true)}
          {metric("Excluded", excluded.length, "Only in this browser session")}
          {metric("Included", reviewed.length, "Used in reviewed results")}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 sm:p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
            <div><h2 className="text-lg font-semibold">Impact on results</h2><p className="text-sm text-slate-500 dark:text-slate-400">Positive = funny or very funny</p></div>
            <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">Session-only preview</span>
          </div>
          <div className="grid gap-5 sm:grid-cols-3">
            <div><p className="text-sm text-slate-500">Original positive rate</p><p className="mt-1 text-3xl font-semibold">{pct(originalPositive, analyzed.length)}</p><p className="mt-1 text-xs text-slate-500">{originalPositive} positive / {analyzed.length} votes</p></div>
            <div><p className="text-sm text-slate-500">After exclusions</p><p className="mt-1 text-3xl font-semibold">{pct(reviewedPositive, reviewed.length)}</p><p className="mt-1 text-xs text-slate-500">{reviewedPositive} positive / {reviewed.length} votes</p></div>
            <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-800/60"><p className="text-sm text-slate-500 dark:text-slate-400">Change</p><p className="mt-1 text-3xl font-semibold">{delta === null ? "—" : (delta > 0 ? "+" : "") + delta.toFixed(1) + " pp"}</p><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Percentage-point difference</p></div>
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-5 dark:border-slate-800">
            <div><h2 className="text-lg font-semibold">Review votes</h2><p className="text-sm text-slate-500 dark:text-slate-400">Flags suggest a closer look, not confirmed abuse.</p></div>
            <div className="flex flex-wrap gap-2">
              <button className={button} onClick={() => setShowSettings(v => !v)} aria-expanded={showSettings}>Detection settings {showSettings ? "▴" : "▾"}</button>
              <button className={button} onClick={() => setExcluded([])} disabled={!excluded.length}>Reset exclusions</button>
            </div>
          </div>
          {showSettings && <div className="grid gap-5 border-b border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-800/40 sm:grid-cols-2">
            <label className="space-y-2"><span className="flex justify-between text-sm font-medium"><span>Fast response threshold</span><span>{speed} ms</span></span><input className="w-full accent-indigo-600" type="range" min="300" max="5000" step="100" value={speed} onChange={e => {setSpeed(Number(e.target.value));setPage(0);}}/><span className="block text-xs text-slate-500">Responses faster than this are flagged.</span></label>
            <label className="space-y-2"><span className="flex justify-between text-sm font-medium"><span>High-frequency threshold</span><span>{burst} votes / 60s</span></span><input className="w-full accent-indigo-600" type="range" min="3" max="20" value={burst} onChange={e => {setBurst(Number(e.target.value));setPage(0);}}/><span className="block text-xs text-slate-500">Votes within a centered 60-second window.</span></label>
          </div>}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
            <div className="flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800" role="group" aria-label="Filter votes">
              {([["flagged", "Needs review", flagged.length], ["all", "All votes", analyzed.length], ["excluded", "Excluded", excluded.length]] as const).map(([key, label, count]) => <button key={key} onClick={() => setTab(key)} className={`rounded-md px-3 py-2 text-sm font-medium transition ${filter === key ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white" : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"}`}>{label} <span className="ml-1 text-xs opacity-70">{count}</span></button>)}
            </div>
            <input className={input + " w-full sm:w-64"} value={search} onChange={e => {setSearch(e.target.value);setPage(0);}} placeholder="Search vote, user, caption…" aria-label="Search votes"/>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/50 dark:text-slate-400"><tr>{["Vote / time", "Participant", "Caption", "Rating", "Response", "Detection", "Exclude"].map(h => <th key={h} scope="col" className="px-4 py-3 font-semibold">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {visible.map(v => <tr key={v.id} className={excludedSet.has(v.id) ? "bg-slate-50 opacity-60 dark:bg-slate-800/30" : "hover:bg-slate-50/70 dark:hover:bg-slate-800/30"}>
                  <td className="whitespace-nowrap px-4 py-3"><span className="font-semibold">#{v.id}</span><span className="mt-1 block text-xs text-slate-500">{dateText(v.at)}</span></td>
                  <td className="px-4 py-3 font-mono text-xs" title={v.user}>{shortId(v.user)}</td>
                  <td className="px-4 py-3 font-mono text-xs" title={v.caption}>{shortId(v.caption)}</td>
                  <td className="px-4 py-3">{v.value}</td>
                  <td className="whitespace-nowrap px-4 py-3">{v.timeMs === null ? "—" : (v.timeMs / 1000).toFixed(2) + " s"}</td>
                  <td className="px-4 py-3">{v.reasons.length ? <div className="flex flex-wrap gap-1">{v.reasons.map(reason => <span key={reason} className="rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">{reason}</span>)}</div> : <span className="text-xs text-slate-400">No flags</span>}</td>
                  <td className="px-4 py-3"><input type="checkbox" className="h-4 w-4 accent-indigo-600" aria-label={`Exclude vote ${v.id}`} checked={excludedSet.has(v.id)} onChange={() => toggle(v.id)}/></td>
                </tr>)}
              </tbody>
            </table>
            {!visible.length && <div className="px-6 py-16 text-center"><p className="text-lg font-semibold">{!votes.length ? "No votes yet" : filter === "flagged" && !flagged.length ? "No suspicious votes detected" : "No matching votes"}</p><p className="mt-2 text-sm text-slate-500">{!votes.length ? "This study has no vote records. Add test votes to see detection and comparison results." : "Try another filter or adjust the detection thresholds."}</p></div>}
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-5 py-4 text-sm text-slate-500 dark:border-slate-800">
            <span>{filtered.length ? `${currentPage * pageSize + 1}–${Math.min((currentPage + 1) * pageSize, filtered.length)} of ${filtered.length}` : "0 results"}</span>
            <div className="flex items-center gap-3"><button className={button} disabled={currentPage === 0} onClick={() => setPage(p => p - 1)}>Previous</button><span>{currentPage + 1} / {totalPages}</span><button className={button} disabled={currentPage + 1 >= totalPages} onClick={() => setPage(p => p + 1)}>Next</button></div>
          </div>
        </section>
        <p className="text-xs text-slate-500 dark:text-slate-400">Exclusions are temporary and never modify the database. A flag is a heuristic, not a finding of misconduct.</p>
      </div>
    </main>
  );
}
