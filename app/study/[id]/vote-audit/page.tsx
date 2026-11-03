import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { RealVoteAudit, type AuditVote } from "@/components/real-vote-audit";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 1000;

export default async function StudyVoteAuditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const studyId = Number(id);
  if (!Number.isSafeInteger(studyId) || studyId <= 0) notFound();

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) notFound();
  const { data: profile, error: profileError } = await supabase
    .from("profiles").select("is_superadmin").eq("id",user.id).single();
  if (profileError || !profile?.is_superadmin) notFound();

  const { data: study, error: studyError } = await supabase
    .from("studies").select("id").eq("id",studyId).single();
  if (studyError || !study) notFound();

  const mappingIds: number[] = [];
  for (let from=0;;from+=PAGE_SIZE) {
    const { data, error } = await supabase.from("study_caption_mappings")
      .select("id").eq("study_id",studyId).order("id",{ascending:true})
      .range(from,from+PAGE_SIZE-1);
    if (error) throw new Error("Unable to load study mappings: "+error.message);
    mappingIds.push(...(data??[]).map(row=>row.id));
    if (!data || data.length<PAGE_SIZE) break;
  }

  const votes: AuditVote[] = [];
  // Chunk IDs to keep PostgREST query strings reasonably small.
  for (let offset=0;offset<mappingIds.length;offset+=100) {
    const chunk=mappingIds.slice(offset,offset+100);
    for (let from=0;;from+=PAGE_SIZE) {
      const { data, error } = await supabase.from("study_caption_vote_events")
        .select("id,profile_id,caption_id,vote_value,time_to_vote_ms,created_datetime_utc")
        .in("study_caption_mapping_id",chunk)
        .order("id",{ascending:true}).range(from,from+PAGE_SIZE-1);
      if (error) throw new Error("Unable to load study votes: "+error.message);
      for (const v of data??[]) {
        votes.push({
          id:v.id,user:v.profile_id,caption:v.caption_id,value:v.vote_value,
          timeMs:v.time_to_vote_ms,at:v.created_datetime_utc,
        });
      }
      if (!data || data.length<PAGE_SIZE) break;
    }
  }

  votes.sort((a,b)=>a.id-b.id);
  return <RealVoteAudit votes={votes} studyId={studyId}/>;
}
