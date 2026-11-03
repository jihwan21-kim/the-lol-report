"use client";

import { useMemo, useState } from "react";

export type AuditVote = { id:number; user:string; caption:string; value:string; timeMs:number|null; at:string };
type Vote = AuditVote & { reasons:string[] };
const isPositive = (v:AuditVote) => ["funny","very funny","up","vote up","1"].includes(v.value.toLowerCase());
const voteDirection = (v:AuditVote) => isPositive(v) ? "Vote Up" : "Vote Down";
const percent = (n:number,d:number) => d ? (n/d*100).toFixed(1)+"%" : "N/A";
const csvCell = (v:string|number|null) => '"' + String(v ?? "").replace(/"/g,'""') + '"';
const button = "rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800";

export function RealVoteAudit({votes,studyId}:{votes:AuditVote[];studyId:number}) {
  const [tab,setTab] = useState<"charts"|"review"|"overview">("charts");
  const [seconds,setSeconds] = useState(1);
  const [burst,setBurst] = useState(8);
  const [removeBurst,setRemoveBurst] = useState(false);
  const [excluded,setExcluded] = useState<number[]>([]);
  const [query,setQuery] = useState("");
  const [page,setPage] = useState(0);
  const [reviewFilter,setReviewFilter] = useState<"flagged"|"all"|"excluded">("flagged");
  const manual = useMemo(()=>new Set(excluded),[excluded]);
  const analyzed = useMemo<Vote[]>(()=>{
    const byUser=new Map<string,number[]>();
    for(const v of votes) {
      const t=Date.parse(v.at);
      if(!Number.isFinite(t)) continue;
      byUser.set(v.user,[...(byUser.get(v.user)??[]),t]);
    }
    return votes.map(v=>{
      const t=Date.parse(v.at);
      const frequency=Number.isFinite(t) ? (byUser.get(v.user)??[]).filter(x=>Math.abs(x-t)<=30000).length : 0;
      const reasons=[
        ...(v.timeMs!==null && v.timeMs>=0 && v.timeMs<seconds*1000 ? ["Fast response"]:[]),
        ...(frequency>=burst ? ["High frequency"]:[])
      ];
      return {...v,reasons};
    });
  },[votes,seconds,burst]);
  const flagged=analyzed.filter(v=>v.reasons.length>0);
  const effectiveExcluded=useMemo(()=>new Set([...excluded,...analyzed.filter(v=>
    (v.timeMs!==null && v.timeMs>=0 && v.timeMs<seconds*1000) ||
    (removeBurst && v.reasons.includes("High frequency"))
  ).map(v=>v.id)]),[excluded,analyzed,seconds,removeBurst]);
  const included=analyzed.filter(v=>!effectiveExcluded.has(v.id));
  const stats=useMemo(()=>{
    const groups=new Map<string,Vote[]>();
    for(const v of analyzed) groups.set(v.caption,[...(groups.get(v.caption)??[]),v]);
    return [...groups].map(([id,rows],index)=>{
      const kept=rows.filter(v=>!effectiveExcluded.has(v.id));
      const before=100*rows.filter(isPositive).length/rows.length;
      const after=kept.length ? 100*kept.filter(isPositive).length/kept.length : null;
      return {id,label:"Humor "+(index+1),total:rows.length,kept:kept.length,flagged:rows.filter(v=>v.reasons.length).length,before,after,delta:after===null?null:after-before};
    }).sort((a,b)=>a.label.localeCompare(b.label,undefined,{numeric:true}));
  },[analyzed,effectiveExcluded]);
  const ratings = ["Vote Up","Vote Down"];
  const bubbleCounts = useMemo(()=>stats.map(s=>ratings.map(rating=>included.filter(v=>v.caption===s.id && voteDirection(v)===rating).length)),[stats,included]);
  const maxBubble = Math.max(1,...bubbleCounts.flat());
  const shownStats = stats;
  const overallBefore=percent(analyzed.filter(isPositive).length,analyzed.length);
  const overallAfter=percent(included.filter(isPositive).length,included.length);
  const exportCsv=()=>{
    const header=["caption_id","total_votes","included_votes","flagged_votes","original_positive_pct","filtered_positive_pct","difference_pp","fast_vote_threshold_seconds","remove_high_frequency"];
    const lines=stats.map(s=>[s.id,s.total,s.kept,s.flagged,s.before.toFixed(2),s.after?.toFixed(2)??"",s.delta?.toFixed(2)??"",seconds,String(removeBurst)].map(csvCell).join(","));
    const url=URL.createObjectURL(new Blob([[header.join(","),...lines].join("\r\n")],{type:"text/csv;charset=utf-8"}));
    const link=document.createElement("a");link.href=url;link.download=`study-${studyId}-humor-comparison.csv`;link.click();URL.revokeObjectURL(url);
  };
  const filtered=analyzed.filter(v=>{
    if(reviewFilter==="flagged" && !v.reasons.length) return false;
    if(reviewFilter==="excluded" && !effectiveExcluded.has(v.id)) return false;
    return !query || [String(v.id),v.user,v.caption,v.value].some(s=>s.toLowerCase().includes(query.toLowerCase()));
  });
  const pageCount=Math.max(1,Math.ceil(filtered.length/20));
  const current=Math.min(page,pageCount-1);
  const visible=filtered.slice(current*20,current*20+20);

  // Categorical bubble matrix: one circle per (humor, rating), area proportional to votes.
  const width=1100,left=120,right=20,top=30,bottom=66;
  const rowH=96;
  const height=top+bottom+Math.max(1,ratings.length)*rowH;
  const plotW=width-left-right;
  const colW=plotW/Math.max(1,stats.length);
  const radius=(count:number)=>count===0?0:Math.max(1.5,Math.sqrt(count/maxBubble)*Math.min(4.4,colW*.43));
  return <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900 dark:bg-slate-950 dark:text-slate-100 sm:px-8">
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">Humor Study Analytics / Study {studyId}</p><h1 className="mt-1 text-3xl font-bold tracking-tight">Humor rating analysis</h1><p className="mt-1 text-sm text-slate-500">How do fast votes affect which humor is rated funny?</p></div>
        <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800">{studyId===1?"SYNTHETIC TEST DATA":"Research study"}</span>
      </header>
      <nav className="flex flex-wrap gap-2 border-b border-slate-200 pb-3 dark:border-slate-800" aria-label="Dashboard sections">
        {([["charts","Charts & comparison"],["review","Review votes"],["overview","Overview"]] as const).map(([id,label])=><button key={id} onClick={()=>setTab(id)} aria-current={tab===id?"page":undefined} className={`rounded-lg px-4 py-2.5 text-sm font-semibold ${tab===id?"bg-indigo-600 text-white":"bg-white text-slate-600 dark:bg-slate-900 dark:text-slate-300"}`}>{label}</button>)}
      </nav>

      {tab==="charts" && <>
        <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">Exclude votes faster than</h2><p className="text-sm text-slate-500">Move the slider. The chart and results update immediately.</p></div><strong className="rounded-xl bg-indigo-50 px-4 py-2 text-2xl tabular-nums text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">{seconds.toFixed(1)} s</strong></div>
          <input aria-label="Minimum response time in seconds" type="range" min="0" max="5" step="0.1" value={seconds} onChange={e=>setSeconds(Number(e.target.value))} className="mt-5 w-full cursor-pointer accent-indigo-600"/>
          <div className="mt-1 flex justify-between text-xs text-slate-500"><span>0 s (keep all)</span><span>2.5 s</span><span>5 s</span></div>
          <label className="mt-4 flex items-center gap-2 text-sm"><input type="checkbox" checked={removeBurst} onChange={e=>setRemoveBurst(e.target.checked)} className="h-4 w-4 accent-indigo-600"/>Also exclude high-frequency votes (≥ {burst} votes / 60 s)</label>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {([["Total votes",votes.length],["Excluded",effectiveExcluded.size],["Original funny rate",overallBefore],["Filtered funny rate",overallAfter]] as const).map(([label,value])=><div key={label} className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p></div>)}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><h2 className="text-lg font-semibold">Humor × vote: Up / Down distribution</h2><p className="mt-1 text-sm text-slate-500">Each dot represents votes for a humor and rating combination. Vote Up and Vote Down by humor. All 100 humors fit in one chart; small dot area represents vote count.</p></div>
            <button className={button} onClick={exportCsv} disabled={!stats.length}>Download CSV ↓</button>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-5 text-xs text-slate-500">
            <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-indigo-600"/>Included votes</span>
            <span>Dot area ∝ vote count</span>
            <span>Move the time slider to filter votes live</span>
          </div>
          <p className="mt-3 text-sm text-slate-500">All {stats.length} humors are shown at once. Hover over a dot to see its vote count.</p>
          {stats.length && ratings.length ? <div className="mt-3 w-full">
            <svg viewBox={`0 0 ${width} ${height}`} className="block h-auto w-full" role="img" aria-label="Bubble chart with humor on horizontal axis and rating categories on vertical axis. Bubble size represents included vote count.">
              {ratings.map((rating,j)=>{const cy=top+(j+.5)*rowH;return <g key={rating}>
                <line x1={left} x2={width-right} y1={cy} y2={cy} stroke="currentColor" opacity=".12"/>
                <text x={left-14} y={cy+5} textAnchor="end" fontSize="14" fill="currentColor">{rating}</text>
              </g>})}
              {shownStats.map((s,i)=>{const cx=left+(i+.5)*colW;return <g key={s.id}>
                <line x1={cx} x2={cx} y1={top} y2={height-bottom} stroke="currentColor" opacity=".09"/>
                <text x={cx} y={height-bottom+28} textAnchor="middle" fontSize="13" fill="currentColor">{(i===0 || (i+1)%10===0 || i===stats.length-1) ? s.label : ""}</text>
              </g>})}
              <line x1={left} x2={left} y1={top} y2={height-bottom} stroke="currentColor" opacity=".5"/>
              <line x1={left} x2={width-right} y1={height-bottom} y2={height-bottom} stroke="currentColor" opacity=".5"/>
              {shownStats.map((s,i)=>ratings.map((rating,j)=>{const count=bubbleCounts[i]?.[j]??0;if(!count)return null;const cx=left+(i+.5)*colW,cy=top+(j+.5)*rowH;return <g key={s.id+rating}>
                <circle cx={cx} cy={cy} r={radius(count)} fill="#4f46e5" fillOpacity=".78" stroke="#312e81" strokeWidth="1.2"><title>{s.label} · {rating}: {count} votes after filtering</title></circle>

              </g>}))}
              <text x={width/2} y={height-12} textAnchor="middle" fontSize="14" fontWeight="600" fill="currentColor">Humor</text>
              <text transform={`translate(18 ${height/2}) rotate(-90)`} textAnchor="middle" fontSize="14" fontWeight="600" fill="currentColor">Rating</text>
            </svg>
          </div> : <p className="py-16 text-center text-sm text-slate-500">No vote ratings available.</p>}
          <p className="mt-2 text-xs text-slate-500">Bubble counts reflect votes remaining after filtering. For Study 1, synthetic six-level test ratings are grouped into Up (funny/very funny) and Down (all other ratings); original stored records are unchanged.</p>
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-3 p-5"><div><h2 className="text-lg font-semibold">Is each humor rated funny?</h2><p className="text-sm text-slate-500">Classification uses a 50% positive-vote threshold. “Insufficient” means no votes remain.</p></div><button className={button} onClick={exportCsv} disabled={!stats.length}>Export results</button></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[660px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800"><tr>{["Humor","Original funny %","Filtered funny %","Change","Votes left","Result"].map(h=><th className="px-4 py-3" key={h}>{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-800">{stats.map(s=><tr key={s.id}><td className="px-4 py-3 font-medium" title={s.id}>{s.label}</td><td className="px-4 py-3">{s.before.toFixed(1)}%</td><td className="px-4 py-3 font-semibold">{s.after===null?"N/A":s.after.toFixed(1)+"%"}</td><td className="px-4 py-3">{s.delta===null?"—":(s.delta>0?"+":"")+s.delta.toFixed(1)+" pp"}</td><td className="px-4 py-3">{s.kept} / {s.total}</td><td className="px-4 py-3"><span className={`rounded-md px-2 py-1 text-xs font-semibold ${s.after===null?"bg-slate-100 text-slate-600":s.after>=50?"bg-emerald-50 text-emerald-700":"bg-rose-50 text-rose-700"}`}>{s.after===null?"Insufficient":s.after>=50?"Rated funny":"Rated not funny"}</span></td></tr>)}</tbody></table>{!stats.length&&<p className="p-8 text-center text-sm text-slate-500">No humor ratings available.</p>}</div>
        </section>
      </>}

      {tab==="review" && <section className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3 p-5"><div><h2 className="text-lg font-semibold">Review individual votes</h2><p className="text-sm text-slate-500">Manually excluded votes also update the charts.</p></div><button className={button} onClick={()=>setExcluded([])}>Reset manual exclusions</button></div>
        <div className="flex flex-wrap gap-3 border-y border-slate-100 p-4 dark:border-slate-800">
          {(["flagged","all","excluded"] as const).map(id=><button key={id} className={button+(reviewFilter===id?" bg-indigo-50 text-indigo-700":"")} onClick={()=>{setReviewFilter(id);setPage(0)}}>{id==="flagged"?"Needs review":id==="all"?"All votes":"Excluded"}</button>)}
          <input aria-label="Search votes" value={query} onChange={e=>{setQuery(e.target.value);setPage(0)}} placeholder="Search ID or rating…" className="ml-auto rounded-lg border border-slate-200 px-3 py-2 text-sm dark:bg-slate-900"/>
        </div>
        <div className="overflow-x-auto"><table className="w-full min-w-[780px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800"><tr>{["Vote","Participant","Caption","Rating","Response time","Reason","Manual exclusion"].map(h=><th className="px-3 py-3" key={h}>{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-800">{visible.map(v=><tr key={v.id} className={effectiveExcluded.has(v.id)?"opacity-55":""}><td className="px-3 py-3">#{v.id}</td><td className="px-3 py-3 font-mono text-xs" title={v.user}>{v.user.slice(0,8)}…</td><td className="px-3 py-3 font-mono text-xs" title={v.caption}>{v.caption.slice(0,8)}…</td><td className="px-3 py-3">{v.value}</td><td className="px-3 py-3">{v.timeMs===null?"N/A":(v.timeMs/1000).toFixed(2)+" s"}</td><td className="px-3 py-3 text-amber-700">{v.reasons.join(", ")||"None"}</td><td className="px-3 py-3"><input aria-label={`Exclude vote ${v.id}`} type="checkbox" checked={manual.has(v.id)} onChange={()=>setExcluded(old=>old.includes(v.id)?old.filter(x=>x!==v.id):[...old,v.id])}/></td></tr>)}</tbody></table></div>
        <div className="flex items-center justify-between p-4 text-sm"><span>{filtered.length} matching votes</span><div className="flex items-center gap-3"><button className={button} disabled={current===0} onClick={()=>setPage(p=>p-1)}>Previous</button><span>{current+1} / {pageCount}</span><button className={button} disabled={current+1>=pageCount} onClick={()=>setPage(p=>p+1)}>Next</button></div></div>
      </section>}

      {tab==="overview" && <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{([["Total votes",votes.length],["Flagged votes",flagged.length],["Excluded by rules",effectiveExcluded.size],["Included votes",included.length]] as const).map(([label,n])=><div key={label} className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-3xl font-semibold">{n}</p></div>)}<div className="col-span-full rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"><h2 className="font-semibold">Detection settings</h2><label className="mt-3 block text-sm">High-frequency threshold: {burst} votes in 60 seconds<input className="mt-2 block w-full accent-indigo-600" type="range" min="3" max="20" step="1" value={burst} onChange={e=>setBurst(Number(e.target.value))}/></label></div></section>}
      <p className="pb-5 text-xs text-slate-500">All filtering is a temporary analysis preview. Original votes remain unchanged. {studyId===1?"All records shown here are synthetic test data.":""}</p>
    </div>
  </main>;
}
