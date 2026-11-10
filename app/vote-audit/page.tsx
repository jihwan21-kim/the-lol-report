import { RealVoteAudit, type AuditVote } from "@/components/real-vote-audit";

// Deliberately exaggerated, reproducible DEMO data; never written to Supabase.
// 100 participants x 100 humors = 10,000 votes:
// - 45 rapid voters: every response between 0.1 and 0.999 seconds.
// - 10 repetitive voters: consistently vote Up or Down, without fast responses.
// - 45 ordinary voters: slower, varied responses.
// Rapid voters push some humors Up and others Down so filtering noticeably
// changes ratings and rankings. This is NOT representative of real study data.
const started=Date.parse("2026-10-20T14:00:00Z");
const demoVotes:AuditVote[]=Array.from({length:10000},(_,i)=>{
  const person=Math.floor(i/100);
  const humor=i%100;
  const rapid=person<45;
  const repetitive=person>=45 && person<55;
  const popularity=15+((humor*23)%71);
  const signal=(person*37+humor*13)%100;
  const targetPositive=humor%4<2;
  const followsTarget=(person*13+humor*19)%10<9;
  const positive=rapid
    ? (followsTarget ? targetPositive : !targetPositive)
    : repetitive
      ? person<50
      : signal<popularity;
  return {
    id:i+1,
    user:"P-"+String(person+1).padStart(3,"0"),
    caption:"humor-"+String(humor+1).padStart(3,"0"),
    value:positive?"funny":"not funny",
    timeMs:rapid?100+((person*71+humor*89)%900):1800+((person*79+humor*131)%9000),
    at:new Date(started+person*18000000+humor*(rapid?1100:repetitive?12000:45000)).toISOString()
  };
});

export default function VoteAuditDemoPage(){
  return <RealVoteAudit votes={demoVotes} studyId={1}/>;
}
