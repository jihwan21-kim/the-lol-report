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

export function RealVoteAudit({ votes, studyId }: { votes: AuditVote[]; studyId: number }) {
  const [speed, setSpeed] = useState(1000);
  const [burst, setBurst] = useState(8);
  const [excluded, setExcluded] = useState<number[]>([]);
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const analyzed = useMemo(() => {
    const byUser = new Map<string, number[]>();
    for (const vote of votes) {
      const times = byUser.get(vote.user) ?? [];
      times.push(Date.parse(vote.at));
      byUser.set(vote.user, times);
    }
    for (const times of byUser.values()) times.sort((a,b) => a-b);
    return votes.map(v => {
      const times = byUser.get(v.user) ?? [];
      const t = Date.parse(v.at);
      const count = times.filter(x => Math.abs(x-t) <= 30000).length;
      const reasons = [
        ...(v.timeMs !== null && v.timeMs >= 0 && v.timeMs < speed ? [`Fast response (${v.timeMs} ms)`] : []),
        ...(count >= burst ? [`High frequency (${count} votes in 60s window)`] : []),
      ];
      return {...v,reasons};
    });
  }, [votes,speed,burst]);
  const flagged = analyzed.filter(v=>v.reasons.length>0);
  const reviewed = analyzed.filter(v=>!excluded.includes(v.id));
  const positive = (v:AuditVote) => v.value === "funny" || v.value === "very funny";
  const rate = (rows:AuditVote[]) => rows.length ? (100*rows.filter(positive).length/rows.length).toFixed(1)+"%" : "N/A";
  const visible = flaggedOnly ? flagged : analyzed;
  return <main style={{maxWidth:1200,margin:"auto",padding:"32px 20px"}}>
    <p style={{fontSize:13,opacity:.75}}>STUDY {studyId} · AUTHENTICATED RESEARCH DATA</p>
    <h1 style={{fontSize:32,fontWeight:750}}>Vote Integrity Review</h1>
    <p>Review unusual activity without deleting original votes. Exclusions only affect this browser session.</p>
    <div style={{display:"flex",gap:12,flexWrap:"wrap",margin:"24px 0"}}>
      {([["Total votes",votes.length],["Flagged votes",flagged.length],["Excluded votes",excluded.length],["Original positive rate",rate(analyzed)],["Reviewed positive rate",rate(reviewed)]] as [string,string|number][]).map(([k,v])=><div key={k} style={{border:"1px solid #64748b",borderRadius:12,padding:16,minWidth:160}}><small>{k}</small><div style={{fontSize:25,fontWeight:700}}>{v}</div></div>)}
    </div>
    <div style={{display:"flex",gap:25,flexWrap:"wrap",marginBottom:20}}>
      <label>Fast vote: {speed} ms <input type="range" min="300" max="5000" step="100" value={speed} onChange={e=>setSpeed(Number(e.target.value))}/></label>
      <label>Frequency: {burst} votes/60s <input type="range" min="3" max="20" value={burst} onChange={e=>setBurst(Number(e.target.value))}/></label>
      <label><input type="checkbox" checked={flaggedOnly} onChange={e=>setFlaggedOnly(e.target.checked)}/> Flagged only</label>
      <button onClick={()=>setExcluded([])} style={{textDecoration:"underline"}}>Reset exclusions</button>
    </div>
    <p style={{fontSize:13,opacity:.75}}>Flags are indicators for review, not proof of abuse. Missing response times are not flagged as fast.</p>
    <div style={{overflowX:"auto"}}>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
        <thead><tr>{["Vote","Participant ID","Caption ID","Rating","Response time","Flag reason","Exclude"].map(h=><th key={h} style={{textAlign:"left",padding:10,borderBottom:"1px solid #64748b"}}>{h}</th>)}</tr></thead>
        <tbody>{visible.map(v=><tr key={v.id} style={{opacity:excluded.includes(v.id)?.45:1}}><td style={{padding:9}}>{v.id}</td><td style={{padding:9}}>{v.user}</td><td style={{padding:9}}>{v.caption}</td><td style={{padding:9}}>{v.value}</td><td style={{padding:9}}>{v.timeMs===null?"N/A":v.timeMs+" ms"}</td><td style={{padding:9}}>{v.reasons.join("; ")||"None"}</td><td style={{padding:9}}><input type="checkbox" aria-label={`Exclude vote ${v.id}`} checked={excluded.includes(v.id)} onChange={e=>setExcluded(old=>e.target.checked?[...old,v.id]:old.filter(x=>x!==v.id))}/></td></tr>)}</tbody>
      </table>
    </div>
  </main>;
}
