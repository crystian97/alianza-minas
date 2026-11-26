import {useEffect,useState,type FormEvent} from 'react';
import {listParticipations,saveParticipations,type Participation} from './lib/admin';
import {listMatches,listRemotePlayers,errorMessage} from './lib/remote';
import type {ManagedMatch} from './lib/store';
import type {Player} from './lib/players';
import {matchDate} from './lib/agenda';
export default function AdminParticipations(){
  const [matches,setMatches]=useState<ManagedMatch[]>([]),[players,setPlayers]=useState<Player[]>([]),[allRows,setAllRows]=useState<Participation[]>([]);
  const [selected,setSelected]=useState(''),[rows,setRows]=useState<Record<string,number>>({});
  const [error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
  async function refresh(){try{const [games,roster,parts]=await Promise.all([listMatches(true),listRemotePlayers(true),listParticipations()]);setMatches(games.filter(g=>g.status==='Finalizado'));setPlayers(roster);setAllRows(parts);}catch(e){setError(errorMessage(e));}finally{setLoading(false);}}
  useEffect(()=>{void refresh();},[]);
  useEffect(()=>{setRows(Object.fromEntries(allRows.filter(r=>r.match_id===selected).map(r=>[r.player_id,r.goals])));},[selected,allRows]);
  const match=matches.find(m=>m.id===selected);const total=Object.values(rows).reduce((sum,n)=>sum+n,0);
  async function save(e:FormEvent){e.preventDefault();if(!match||busy)return;setBusy(true);setError('');try{await saveParticipations(match.id,match.version!,Object.entries(rows).map(([player_id,goals])=>({player_id,goals})));setMessage('Participações salvas. Os atletas já podem ser candidatos à votação da semana.');await refresh();}catch(e){setError(errorMessage(e));}finally{setBusy(false);}}
  return <section className="admin-page"><h1>Participações e gols</h1><p className="admin-notice">Finalize o jogo e registre o placar em Jogos. Depois marque quem participou. Essas participações definem os candidatos ao craque da semana.</p>
    {error&&<p role="alert" className="admin-error">{error}</p>}{message&&<p role="status" className="admin-success">{message}</p>}
    {loading?<p role="status">Carregando partidas…</p>:<form className="admin-form" onSubmit={save}><fieldset disabled={busy}><div className="form-grid"><label className="full-field">Partida finalizada<select required value={selected} onChange={e=>{setSelected(e.target.value);setMessage('');setError('');}}><option value="">Selecione uma partida</option>{matches.map(m=><option key={m.id} value={m.id}>{matchDate(m.date).full} · {m.opponent} · {m.goalsFor} × {m.goalsAgainst}</option>)}</select></label></div>
    {match&&<><p className="form-hint">Gols atribuídos: {total} de {match.goalsFor}. Gols sem autor identificado ou contra podem ficar sem atribuição.</p><div className="admin-list">{players.filter(p=>p.active||p.id in rows).map(p=><div className="participant-row" key={p.id}><label><input type="checkbox" checked={p.id in rows} onChange={e=>setRows(current=>{const next={...current};if(e.target.checked)next[p.id]=0;else delete next[p.id];return next;})}/>{p.name}{!p.active?' · Inativo':''}</label>{p.id in rows&&<label>Gols de {p.name}<input aria-label={`Gols de ${p.name}`} type="number" min={0} max={match.goalsFor??0} required value={rows[p.id]} onChange={e=>setRows({...rows,[p.id]:Number(e.target.value)})}/></label>}</div>)}</div><button className="primary" disabled={total>(match.goalsFor??0)}>{busy?'Salvando…':'Salvar participações'}</button></>}
    {!matches.length&&<p className="empty">Nenhuma partida finalizada ainda.</p>}</fieldset></form>}
    <button className="text-button" disabled={busy} onClick={()=>{setError('');void refresh();}}>Recarregar partidas e participações</button>
  </section>;
}
