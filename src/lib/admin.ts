import { getSupabase } from './supabase';
import type { Profile } from '../auth';
export type Member = Profile & { email: string };
export type Participation = {match_id: string;player_id: string;goals: number};
export type Poll = {id:string;title:string;week_start:string;opens_at:string;closes_at:string;state:'draft'|'published';version?:number;matchIds:string[];candidateIds:string[]};
export async function listMembers():Promise<Member[]> {
  const {data,error}=await getSupabase().rpc('admin_members');if(error)throw error;return data??[];
}
export async function updateMember(member:Member){
  const {error}=await getSupabase().rpc('manage_member',{p_id:member.id,p_name:member.display_name,p_role:member.role,p_active:member.active});if(error)throw error;
}
export async function listParticipations():Promise<Participation[]> {
  const {data,error}=await getSupabase().from('match_players').select('match_id,player_id,goals');if(error)throw error;return data??[];
}
export async function saveParticipations(id:string,version:number,rows:Omit<Participation,'match_id'>[]) {
  const {error}=await getSupabase().rpc('save_participations',{p_match_id:id,p_expected_version:version,p_rows:rows});if(error)throw error;
}
export async function listPolls():Promise<Poll[]> {
  const {data,error}=await getSupabase().from('weekly_polls').select('*,poll_matches(match_id),poll_candidates(player_id)').order('week_start',{ascending:false});if(error)throw error;
  return (data??[]).map(p=>({...p,matchIds:p.poll_matches.map((r:{match_id:string})=>r.match_id),candidateIds:p.poll_candidates.map((r:{player_id:string})=>r.player_id)}));
}
export async function savePoll(poll:Poll) {
  const {matchIds,candidateIds,version,...fields}=poll;
  const {error}=await getSupabase().rpc('save_poll',{p_poll:fields,p_matches:matchIds,p_candidates:candidateIds,p_expected_version:version??null});if(error)throw error;
}
export async function deletePoll(poll:Poll) {
  const {error}=await getSupabase().rpc('delete_poll',{p_id:poll.id,p_expected_version:poll.version});if(error)throw error;
}
export function localDateTime(iso:string){return iso?new Date(Date.parse(iso)-10800000).toISOString().slice(0,16):'';}
export function brasiliaDate(iso:string){return localDateTime(iso).slice(0,10);}
export function monday(date=new Date()){
  const day=new Date(`${brasiliaDate(date.toISOString())}T12:00:00Z`);
  day.setUTCDate(day.getUTCDate()-(day.getUTCDay()+6)%7);return day.toISOString().slice(0,10);
}
