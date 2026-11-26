import { useEffect, useState } from 'react';
import { getSupabase } from './lib/supabase';
import { errorMessage } from './lib/remote';
type Poll = {id:string;title:string;opens_at:string;closes_at:string};
type Result = {player_id:string;votes:number;percentage:number;winner:boolean;name:string};
export default function Voting({canVote}:{canVote:boolean}){
  const [polls,setPolls]=useState<Poll[]>([]);const [selected,setSelected]=useState('');const [results,setResults]=useState<Result[]>([]);
  const [voted,setVoted]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [loaded,setLoaded]=useState(false);const [now,setNow]=useState(Date.now());
  const poll=polls.find(p=>p.id===selected);
  async function refresh(id:string){
    const [totals,participation]=await Promise.all([getSupabase().rpc('poll_results',{p_poll_id:id}),getSupabase().rpc('has_voted',{p_poll_id:id})]);
    if(totals.error)throw totals.error;if(participation.error)throw participation.error;
    const values=totals.data as Omit<Result,'name'>[];
    const names=await getSupabase().from('players').select('id,name').in('id',values.map(v=>v.player_id));if(names.error)throw names.error;
    return {results:values.map(r=>({...r,name:names.data?.find(p=>p.id===r.player_id)?.name??'Jogador'})),voted:Boolean(participation.data)};
  }
  useEffect(()=>{let alive=true;void getSupabase().from('weekly_polls').select('id,title,opens_at,closes_at').eq('state','published').order('week_start',{ascending:false}).then(({data,error})=>{if(!alive)return;if(error)setError(errorMessage(error));else{setPolls(data??[]);setSelected(data?.[0]?.id??'');}setLoaded(true);});return()=>{alive=false;};},[]);
  useEffect(()=>{let alive=true;setResults([]);setVoted(false);if(!selected)return;const reload=()=>{void refresh(selected).then(data=>{if(alive){setResults(data.results);setVoted(data.voted);setNow(Date.now());setError('');}}).catch(e=>{if(alive)setError(errorMessage(e));});};reload();const timer=window.setInterval(reload,30_000);return()=>{alive=false;window.clearInterval(timer);};},[selected]);
  async function vote(row:Result){if(busy||!window.confirm(`Confirmar voto em ${row.name}? Seu voto não poderá ser alterado.`))return;setBusy(true);setError('');try{const {error}=await getSupabase().rpc('cast_vote',{p_poll_id:selected,p_player_id:row.player_id});if(error)throw error;setVoted(true);const data=await refresh(selected);setResults(data.results);}catch(e){setError(errorMessage(e));}finally{setBusy(false);}}
  const open=Boolean(poll&&now>=Date.parse(poll.opens_at)&&now<Date.parse(poll.closes_at));
  return <section className="admin-page"><h1>Craque da semana</h1><p>Um voto definitivo por pessoa. Os totais são visíveis, sem identificar quem votou em quem.</p>{error&&<p className="admin-error" role="alert">{error}</p>}
    {!loaded?<p role="status">Carregando votações…</p>:!polls.length?<p className="empty">Nenhuma votação publicada ainda.</p>:<><div className="filters"><select aria-label="Escolher votação" disabled={busy} value={selected} onChange={e=>setSelected(e.target.value)}>{polls.map(p=><option key={p.id} value={p.id}>{p.title}</option>)}</select></div>
    <p>{open?'Votação aberta':poll&&now<Date.parse(poll.opens_at)?'Votação ainda não iniciou':'Votação encerrada'}{voted?' · Seu voto foi registrado.':''}</p>
    {poll&&<p>Encerramento: {new Date(poll.closes_at).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})} · Brasília</p>}
    <div className="admin-list">{results.map(row=><article className="admin-match" key={row.player_id}><div className="admin-match-info"><h2>{row.name}</h2><p>{row.votes} votos · {row.percentage}%{row.winner?' · 🏆 Craque da semana':''}</p></div>{open&&canVote&&!voted&&<button className="admin-secondary" disabled={busy} onClick={()=>void vote(row)}>Votar</button>}</article>)}</div>
    {poll&&now>=Date.parse(poll.closes_at)&&results.length>0&&results.every(r=>r.votes===0)&&<p>Encerrada sem vencedor.</p>}
    {!canVote&&<p className="form-hint">O perfil administrador acompanha os resultados. A votação é destinada aos perfis jogador e comissão.</p>}</>}
  </section>;
}
