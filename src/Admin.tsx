import { useEffect, useState, type FormEvent } from 'react';
import { matchDate } from './lib/agenda';
import type { ManagedMatch } from './lib/store';
import { listMatches, saveMatch, deleteMatch, listOpponents, errorMessage, type Opponent } from './lib/remote';

export function AdminNav({ navigate }: { navigate: (path: string) => void }) {
  return <nav className="internal-tabs" aria-label="Administração">{[['/admin','Jogos'],['/admin/jogadores','Jogadores e fotos'],['/admin/adversarios','Adversários'],['/admin/participacoes','Participações'],['/admin/votacoes','Votações'],['/admin/usuarios','Usuários'],['/admin/migracao','Dados locais']].map(([path,label]) => <button key={path} onClick={() => navigate(path)}>{label}</button>)}</nav>;
}
function dateInput(value: string) {
  if (!value) return '';
  return new Date(new Date(value).getTime() - 3 * 60 * 60 * 1000).toISOString().slice(0,16);
}
export default function Admin({ navigate }: { navigate: (path: string) => void }) {
  const [matches, setMatches] = useState<ManagedMatch[]>([]); const [opponents,setOpponents] = useState<Opponent[]>([]);
  const [editing,setEditing] = useState<ManagedMatch | null>(null); const [query,setQuery] = useState('');
  const [error,setError] = useState(''); const [message,setMessage] = useState(''); const [busy,setBusy] = useState(false); const [loading,setLoading] = useState(true);
  async function refresh() {
    try { const [games,teams] = await Promise.all([listMatches(true),listOpponents()]); setMatches(games); setOpponents(teams); }
    catch(cause) { setError(errorMessage(cause)); } finally { setLoading(false); }
  }
  useEffect(() => { void refresh(); }, []);
  async function change(action: () => Promise<void>, success: string) {
    if(busy) return; setBusy(true); setError(''); setMessage('');
    try { await action(); setEditing(null); setMessage(success); await refresh(); }
    catch(cause) { setError(errorMessage(cause)); } finally { setBusy(false); }
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if(!editing) return;
    const date = String(new FormData(event.currentTarget).get('date'));
    void change(() => saveMatch({...editing,date:`${date}:00-03:00`}), 'Partida salva no banco online.');
  }
  return <section className="admin-page"><div className="admin-heading"><div><div className="eyebrow">GESTÃO DO ALIANZA</div><h1>Painel <em>administrativo.</em></h1><p>Gerencie os jogos e a agenda compartilhada.</p></div><button className="admin-secondary" onClick={()=>navigate('/agenda')}>Ver agenda pública</button></div>
    {error && <p className="admin-error" role="alert">{error}</p>}{message && <p className="admin-success" role="status">{message}</p>}
    <div className="admin-stats"><article><span>Total de jogos</span><strong>{matches.length}</strong></article><article><span>Publicados</span><strong>{matches.filter(m=>m.published).length}</strong></article><article><span>Rascunhos</span><strong>{matches.filter(m=>!m.published).length}</strong></article></div>
    {editing ? <form className="admin-form" onSubmit={submit}><h2>{editing.version?'Editar partida':'Nova partida'}</h2><p className="form-hint">Datas e horários de Brasília.</p><fieldset disabled={busy}><div className="form-grid">
      <label>Adversário *<select required value={editing.opponentId ?? ''} onChange={e=>setEditing({...editing,opponentId:e.target.value})}><option value="">Selecione um time</option>{opponents.filter(o=>o.active || o.id===editing.opponentId).map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
      <label>Data e horário *<input required name="date" type="datetime-local" defaultValue={dateInput(editing.date)}/></label>
      <label>Local *<input required maxLength={120} value={editing.venue} onChange={e=>setEditing({...editing,venue:e.target.value})}/></label>
      <label>Competição *<input required maxLength={80} value={editing.competition} onChange={e=>setEditing({...editing,competition:e.target.value})}/></label>
      <label>Mando<select value={editing.home?'home':'away'} onChange={e=>setEditing({...editing,home:e.target.value==='home'})}><option value="home">Em casa</option><option value="away">Fora de casa</option></select></label>
      <label>Situação<select value={editing.status} onChange={e=>setEditing({...editing,status:e.target.value as ManagedMatch['status']})}>{['Agendado','Adiado','Cancelado','Finalizado'].map(s=><option key={s}>{s}</option>)}</select></label>
      {editing.status==='Finalizado' && <><label>Gols do Alianza *<input required type="number" min={0} max={999} value={editing.goalsFor ?? ''} onChange={e=>setEditing({...editing,goalsFor:e.target.value===''?null:Number(e.target.value)})}/></label><label>Gols do adversário *<input required type="number" min={0} max={999} value={editing.goalsAgainst ?? ''} onChange={e=>setEditing({...editing,goalsAgainst:e.target.value===''?null:Number(e.target.value)})}/></label></>}
      <label className="full-field">Aviso {['Adiado','Cancelado'].includes(editing.status) && '*'}<textarea maxLength={500} required={['Adiado','Cancelado'].includes(editing.status)} value={editing.note || ''} onChange={e=>setEditing({...editing,note:e.target.value})}/></label>
    </div><label className="publish-check"><input type="checkbox" checked={editing.published} onChange={e=>setEditing({...editing,published:e.target.checked})}/>Publicar na agenda</label><div className="form-actions"><button className="primary">{busy?'Salvando…':'Salvar partida'}</button><button type="button" className="admin-secondary" onClick={()=>setEditing(null)}>Cancelar</button></div></fieldset></form> : <>
      <div className="section-heading"><h2>Partidas</h2><button className="primary new-match" disabled={loading || busy || !opponents.some(o=>o.active)} onClick={()=>{setError('');setEditing({id:crypto.randomUUID(),opponent:'',initials:'',color:'#a63b59',date:'',venue:'',competition:'Amistoso',home:true,status:'Agendado',published:false});}}>Novo jogo</button></div>
      {!loading && !opponents.some(o=>o.active) && <p className="admin-notice">Cadastre um adversário ativo antes de criar o jogo. <button className="text-button" onClick={()=>navigate('/admin/adversarios')}>Cadastrar adversário</button></p>}
      <div className="filters"><label className="search"><input aria-label="Buscar partidas" placeholder="Buscar adversário ou local…" value={query} onChange={e=>setQuery(e.target.value)}/></label><button className="admin-secondary" disabled={busy} onClick={()=>{setError('');void refresh();}}>Atualizar</button></div>
      {loading ? <p role="status">Carregando jogos…</p> : <div className="admin-list">{matches.filter(m=>`${m.opponent} ${m.venue}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())).map(m=><article className="admin-match" key={m.id}><div className="admin-match-info"><span>{m.competition} · {m.published?'Publicado':'Rascunho'}</span><h3>Alianza Minas × {m.opponent}</h3><p>{matchDate(m.date).full} · {matchDate(m.date).time} · {m.venue}</p><p>{m.status}{m.status==='Finalizado' && ` · ${m.goalsFor} × ${m.goalsAgainst}`}</p></div><div className="admin-row-actions"><button className="admin-secondary" disabled={busy} onClick={()=>{setError('');setEditing({...m});}}>Editar</button><button className="text-button" disabled={busy} onClick={()=>void change(()=>saveMatch({...m,published:!m.published}),m.published?'Partida retirada da agenda.':'Partida publicada.')}>{m.published?'Retirar da agenda':'Publicar'}</button><button className="text-button" disabled={busy} onClick={()=>{if(window.confirm(`Excluir a partida contra ${m.opponent}? Esta ação não pode ser desfeita.`)) void change(()=>deleteMatch(m),'Partida excluída.');}}>Excluir</button></div></article>)}</div>}
      {!loading && !matches.length && !error && <p className="empty">Nenhum jogo cadastrado no banco online.</p>}
    </>}
  </section>;
}
