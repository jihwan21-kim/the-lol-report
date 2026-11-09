import { RealVoteAudit, type AuditVote } from "@/components/real-vote-audit";

// Reproducible synthetic study: 100 participants x 100 humors = 10,000 votes.
// Fifteen participants deliberately exhibit rapid or repetitive voting.
// This fixture uses no real participant data and is never written to Supabase.
const started=Date.parse("2026-10-20T14:00:00Z");
const demoVotes:AuditVote[]=Array.from({length:10000},(_,i)=>{
  const person=Math.floor(i/100);
  const humor=i%100;
  const suspicious=person<15;
  const rapid=person<8;
  const popularity=10+((humor*23)%81);
  const signal=(person*37+humor*13)%100;
  const positive=suspicious ? person<8 : signal<popularity;
  return {
    id:i+1,
    user:"P-"+String(person+1).padStart(3,"0"),
    caption:"humor-"+String(humor+1).padStart(3,"0"),
    value:positive?"funny":"not funny",
    timeMs:rapid?180+(humor%5)*80:1700+((person*79+humor*131)%9000),
    at:new Date(started+person*18000000+humor*(rapid?480:45000)).toISOString()
  };
});

export default function VoteAuditDemoPage(){
  return <RealVoteAudit votes={demoVotes} studyId={1}/>;
}
