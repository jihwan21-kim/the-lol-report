"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type Vote = { id: number; user: string; caption: string; value: number; timeMs: number; at: number };
const base = Date.parse("2026-10-20T14:00:00Z");
const votes: Vote[] = Array.from({ length: 90 }, (_, i) => {
  const user = i < 18 ? "P-004" : `P-${String(1 + Math.floor((i - 18) / 6)).padStart(3, "0")}`;
  const offset = i < 18 ? i * 1100 : 600000 + (i - 18) * 45000;
  return { id: i + 1, user, caption: `Caption ${1 + (i % 12)}`, value: i < 18 ? 5 : 1 + ((i * 7) % 5), timeMs: i < 18 ? 350 + (i % 4) * 140 : 2400 + ((i * 13) % 9000), at: base + offset };
});
const format = (n: number) => n.toLocaleString();
export default function VoteAuditPage() {
  const [speed, setSpeed] = useState(1000);
  const [burst, setBurst] = useState(8);
  const [show, setShow] = useState<"all" | "flagged">("all");
  const [excluded, setExcluded] = useState<number[]>([]);
  const analyzed = useMemo(() => {
    return votes.map(v => {
      const inMinute = votes.filter(w => w.user === v.user && Math.abs(w.at - v.at) <= 30000).length;
      const reasons = [ ...(v.timeMs < speed ? [`Very fast response (${v.timeMs} ms)`] : []), ...(inMinute >= burst ? [`High-frequency voting (${inMinute} votes/min window)`] : []) ];
      return { ...v, reasons };
    });
  }, [speed, burst]);
  const flagged = analyzed.filter(v => v.reasons.length);
  const filtered = analyzed.filter(v => !excluded.includes(v.id));
  const avg = (items: Vote[]) => items.length ? (items.reduce((sum,v) => sum + v.value, 0) / items.length).toFixed(2) : "N/A";
  const visible = (show === "flagged" ? analyzed.filter(v => v.reasons.length) : analyzed).slice(0, 90);
  return <main style={{maxWidth:1100,margin:"0 auto",padding:"38px 22px",fontFamily:"Arial, sans-serif",color:"#e7edf8",minHeight:"100vh"}}>
    <Link href="/" style={{color:"#9ab6ef"}}>← Back to reports</Link>
    <div style={{marginTop:25,display:"flex",justifyContent:"space-between",alignItems:"start",gap:16,flexWrap:"wrap"}}><div><p style={{color:"#8ca8da",fontWeight:700,letterSpacing:2}}>THE LOL REPORT / RESEARCH TOOLS</p><h1 style={{fontSize:36,margin:"8px 0"}}>Vote Integrity Review</h1><p style={{color:"#aab7cb",maxWidth:670}}>Identify unusual voting activity, review the evidence, and measure how exclusions affect study results.</p></div><span style={{background:"#393321",color:"#f7dc83",padding:"10px 14px",borderRadius:10,fontWeight:700}}>DEMO DATA · 90 SYNTHETIC VOTES</span></div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",gap:12,margin:"28px 0"}}>{[["Total votes",format(analyzed.length)],["Flagged votes",format(flagged.length)],["Excluded votes",format(excluded.length)],["Original mean",avg(analyzed)],["Reviewed mean",avg(filtered)]].map(([label,val])=><div key={label} style={{background:"#18243a",border:"1px solid #2b3d59",borderRadius:14,padding:20}}><div style={{color:"#aab7cb",fontSize:13}}>{label}</div><strong style={{fontSize:29,display:"block",marginTop:9}}>{val}</strong></div>)}</div>
    <section style={{background:"#18243a",border:"1px solid #2b3d59",padding:22,borderRadius:14,marginBottom:20}}><h2 style={{marginTop:0}}>Detection settings</h2><div style={{display:"flex",flexWrap:"wrap",gap:32}}><label style={{flex:1,minWidth:240}}>Fast response threshold: <b>{speed} ms</b><input aria-label="Fast response threshold" style={{width:"100%",display:"block",marginTop:15}} type="range" min="300" max="5000" step="100" value={speed} onChange={e=>setSpeed(Number(e.target.value))}/></label><label style={{flex:1,minWidth:240}}>High-frequency threshold: <b>{burst} votes / 60s</b><input aria-label="High frequency threshold" style={{width:"100%",display:"block",marginTop:15}} type="range" min="3" max="20" value={burst} onChange={e=>setBurst(Number(e.target.value))}/></label></div><p style={{color:"#aab7cb",fontSize:13}}>Flags are review signals, not proof of manipulation. Changing thresholds never deletes records.</p></section>
    <section style={{background:"#18243a",border:"1px solid #2b3d59",borderRadius:14,padding:22}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12}}><h2>Vote review</h2><div style={{display:"flex",gap:8}}><button onClick={()=>setShow("all")} style={btn(show==="all")}>All votes</button><button onClick={()=>setShow("flagged")} style={btn(show==="flagged")}>Flagged only</button><button onClick={()=>setExcluded([])} style={btn(false)}>Reset exclusions</button></div></div><div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:14}}><thead><tr>{["Vote","Participant","Caption","Response","Time","Reason","Review"].map(h=><th key={h} style={{padding:"12px 9px",textAlign:"left",borderBottom:"1px solid #42516a",color:"#aab7cb"}}>{h}</th>)}</tr></thead><tbody>{visible.map(v=><tr key={v.id} style={{opacity:excluded.includes(v.id)?.45:1}}><td style={cell}>#{v.id}</td><td style={cell}>{v.user}</td><td style={cell}>{v.caption}</td><td style={cell}>{v.value}/5</td><td style={cell}>{v.timeMs} ms</td><td style={cell}>{v.reasons.length?<span style={{color:"#ffce86"}}>{v.reasons.join("; ")}</span>:<span style={{color:"#8cbaa5"}}>No flags</span>}</td><td style={cell}><input aria-label={`Exclude vote ${v.id}`} type="checkbox" checked={excluded.includes(v.id)} onChange={e=>setExcluded(old=>e.target.checked?[...old,v.id]:old.filter(id=>id!==v.id))}/></td></tr>)}</tbody></table></div></section><p style={{color:"#aab7cb",fontSize:13,marginTop:20}}>Prototype note: all votes are generated locally for demonstration. Real study data and persistent review decisions are not connected. The reviewed mean excludes only manually checked votes.</p>
  </main>;
}
const cell = {padding:"11px 9px",borderBottom:"1px solid #29374e",verticalAlign:"top" as const};
const btn = (active:boolean) => ({background:active?"#5577d5":"#26344d",color:"white",border:0,borderRadius:8,padding:"9px 12px",cursor:"pointer"});
