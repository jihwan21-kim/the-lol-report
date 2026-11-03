import { TopNavbar } from "@/components/top-navbar";
import { createClient } from "@/utils/supabase/server";
import { RealVoteAudit, type AuditVote } from "@/components/real-vote-audit";
import Link from "next/link";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 1000;

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("is_superadmin").eq("id", user.id).maybeSingle()
    : { data: null };

  const { data: studies, error: studyError } = await supabase.from("studies")
    .select("id,slug").order("id", {ascending:false}).limit(20);
  if (studyError) throw new Error("Unable to load studies: " + studyError.message);
  const selected = studies?.find(s => s.id === 1) ?? studies?.[0];
  const studyId = selected?.id;
  const votes: AuditVote[] = [];

  if (user && profile?.is_superadmin && studyId) {
    const mappingIds: number[] = [];
    for (let from = 0;; from += PAGE_SIZE) {
      const {data,error} = await supabase.from("study_caption_mappings")
        .select("id").eq("study_id",studyId).order("id",{ascending:true}).range(from,from+PAGE_SIZE-1);
      if (error) throw new Error("Unable to load mappings: "+error.message);
      mappingIds.push(...(data ?? []).map(row => row.id));
      if (!data || data.length < PAGE_SIZE) break;
    }
    for (let offset=0; offset<mappingIds.length; offset+=100) {
      const chunk=mappingIds.slice(offset,offset+100);
      for (let from=0;;from+=PAGE_SIZE) {
        const {data,error}=await supabase.from("study_caption_vote_events")
          .select("id,profile_id,caption_id,vote_value,time_to_vote_ms,created_datetime_utc")
          .in("study_caption_mapping_id",chunk).order("id",{ascending:true}).range(from,from+PAGE_SIZE-1);
        if (error) throw new Error("Unable to load votes: "+error.message);
        for (const v of data ?? []) votes.push({
          id:v.id,user:v.profile_id,caption:v.caption_id,value:v.vote_value,
          timeMs:v.time_to_vote_ms,at:v.created_datetime_utc
        });
        if (!data || data.length<PAGE_SIZE) break;
      }
    }
    votes.sort((a,b)=>a.id-b.id);
  }

  return <div className="min-h-screen bg-background">
    <TopNavbar />
    {user && profile?.is_superadmin && studyId ? <>
      <RealVoteAudit votes={votes} studyId={studyId}/>
      <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-8">
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-lg font-semibold">Other research reports</h2>
          <p className="mt-1 text-sm text-slate-500">Explore additional views of the study.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link className="rounded-lg border border-slate-200 px-4 py-2 text-sm dark:border-slate-700" href={`/study/${studyId}/study-detail`}>Study detail</Link>
            <Link className="rounded-lg border border-slate-200 px-4 py-2 text-sm dark:border-slate-700" href={`/study/${studyId}/vote-timing`}>Vote timing</Link>
            <Link className="rounded-lg border border-slate-200 px-4 py-2 text-sm dark:border-slate-700" href={`/study/${studyId}/user-upvote-rate`}>User upvote rates</Link>
            <Link className="rounded-lg border border-slate-200 px-4 py-2 text-sm dark:border-slate-700" href="/reports/study-comparison">Study comparison</Link>
          </div>
        </div>
      </section>
    </> : <main className="mx-auto flex min-h-[65vh] max-w-xl items-center justify-center p-6">
      <div className="w-full rounded-2xl border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
        <h1 className="text-2xl font-semibold">Humor Study Analytics</h1>
        <p className="mt-3 text-sm text-slate-500">{!user ? "Sign in to access the research dashboard." : !profile?.is_superadmin ? "A superadmin account is required to view vote integrity data." : "No studies available yet."}</p>
      </div>
    </main>}
  </div>;
}
