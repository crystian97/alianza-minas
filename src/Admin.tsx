import { useState, type FormEvent } from 'react';
import { CalendarDays, Eye, FilePenLine, Plus, Save, ShieldCheck, X } from 'lucide-react';
import { matchDate } from './lib/agenda';
import type { ManagedMatch } from './lib/store';

type Props = { matches: ManagedMatch[]; onSave: (matches: ManagedMatch[]) => boolean; navigate: (path: string) => void; error: string };
const blank = (): ManagedMatch => ({ id: crypto.randomUUID(), opponent: '', initials: '', color: '#a63b59', date: '', venue: '', competition: 'Amistoso', home: true, status: 'Agendado', published: false, note: '' });

export default function Admin({ matches, onSave, navigate, error }: Props) {
  const [editing, setEditing] = useState<ManagedMatch | null>(null);
  const [query, setQuery] = useState('');
  const [visibility, setVisibility] = useState('Todos');
  const [message, setMessage] = useState('');
  const [formError, setFormError] = useState('');
  const listed = matches.filter(m => `${m.opponent} ${m.venue}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()) && (visibility === 'Todos' || (visibility === 'Publicados' ? m.published : !m.published))).sort((a,b)=>a.date.localeCompare(b.date));
  function edit(match: ManagedMatch) { setEditing({ ...match }); setFormError(''); setMessage(''); }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    const enteredDate = new FormData(event.target as HTMLFormElement).get('date') as string;
    const date = enteredDate ? `${enteredDate.slice(0,16)}:00-03:00` : '';
    if (![editing.opponent, editing.venue, editing.competition, editing.initials].every(v=>v.trim())) { setFormError('Preencha os campos obrigatórios sem usar apenas espaços.'); return; }
    if (!Number.isFinite(Date.parse(date))) { setFormError('Informe uma data e um horário válidos.'); return; }
    if (editing.status !== 'Agendado' && !editing.note?.trim()) { setFormError('Informe um aviso sobre o adiamento ou cancelamento.'); return; }
    const value = { ...editing, date, opponent: editing.opponent.trim(), venue: editing.venue.trim(), competition: editing.competition.trim(), initials: editing.initials.trim().toUpperCase(), note: editing.note?.trim() };
    const exists = matches.some(m=>m.id===value.id);
    if (onSave(exists ? matches.map(m=>m.id===value.id?value:m) : [...matches,value])) { setEditing(null); setMessage(value.published?'Jogo salvo e publicado na agenda deste navegador.':'Rascunho salvo. Este jogo não aparece na agenda.'); }
  }
  function toggle(match: ManagedMatch) {
    if (onSave(matches.map(m=>m.id===match.id?{...m,published:!m.published}:m))) setMessage(match.published?'Jogo retirado da agenda e mantido como rascunho.':'Jogo publicado na agenda deste navegador.');
  }
  return <section className="admin-page">
    <div className="admin-heading"><div><div className="eyebrow"><ShieldCheck size={15}/>GESTÃO DO ALIANZA</div><h1>Painel <em>administrativo.</em></h1><p>Organize os confrontos e mantenha a agenda em dia.</p></div><button className="admin-secondary" onClick={()=>navigate('/agenda')}><Eye size={16}/>Ver agenda</button></div>
    <div className="admin-notice"><ShieldCheck size={20}/><p><strong>Administração local de demonstração.</strong> Sem login nesta etapa. Alterações são salvas apenas neste navegador, não são compartilhadas com o time. Use somente dados de teste.</p></div>
    <button className="primary new-match" style={{marginTop:20}} onClick={()=>navigate('/admin/jogadores')}>Gerenciar jogadores e fotos</button><div className="admin-stats"><article><span>Total de jogos</span><strong>{matches.length}</strong><CalendarDays/></article><article><span>Publicados</span><strong>{matches.filter(m=>m.published).length}</strong><Eye/></article><article><span>Rascunhos</span><strong>{matches.filter(m=>!m.published).length}</strong><FilePenLine/></article></div>
    {error&&<p className="admin-error" role="alert">{error}</p>}{message&&<p className="admin-success" role="status">{message}</p>}
    {editing?<form className="admin-form" onSubmit={submit}><div className="section-heading"><h2>{matches.some(m=>m.id===editing.id)?'Editar partida':'Nova partida'}</h2><button type="button" className="admin-secondary" onClick={()=>setEditing(null)}><X size={16}/>Fechar</button></div><p className="form-hint">Datas e horários de Brasília. Os campos marcados com * são obrigatórios.</p><div className="form-grid">
      <label>Adversário *<input required maxLength={80} value={editing.opponent} onChange={e=>setEditing({...editing,opponent:e.target.value})} placeholder="Ex.: União FC"/></label>
      <label>Sigla do adversário *<input required maxLength={4} value={editing.initials} onChange={e=>setEditing({...editing,initials:e.target.value.toUpperCase()})} placeholder="Ex.: UFC"/></label>
      <label>Data e horário *<input required name="date" type="datetime-local" defaultValue={editing.date.slice(0,16)}/></label>
      <label>Local *<input required maxLength={120} value={editing.venue} onChange={e=>setEditing({...editing,venue:e.target.value})} placeholder="Ex.: Arena Barbosa"/></label>
      <label>Competição *<input required maxLength={80} list="competitions" value={editing.competition} onChange={e=>setEditing({...editing,competition:e.target.value})}/><datalist id="competitions">{Array.from(new Set(['Amistoso',...matches.map(m=>m.competition)])).map(c=><option key={c} value={c}/>)}</datalist></label>
      <label>Mando de campo<select value={editing.home?'home':'away'} onChange={e=>setEditing({...editing,home:e.target.value==='home'})}><option value="home">Alianza Minas · em casa</option><option value="away">Adversário · fora de casa</option></select></label>
      <label>Situação<select value={editing.status} onChange={e=>setEditing({...editing,status:e.target.value as ManagedMatch['status']})}><option>Agendado</option><option>Adiado</option><option>Cancelado</option></select></label>
      <label>Cor do adversário<input type="color" value={editing.color} onChange={e=>setEditing({...editing,color:e.target.value})}/></label>
      <label className="full-field">Aviso para a agenda{editing.status!=='Agendado'?' *':''}<textarea rows={3} maxLength={500} required={editing.status!=='Agendado'} value={editing.note||''} onChange={e=>setEditing({...editing,note:e.target.value})} placeholder="Informações sobre o jogo ou motivo da alteração"/></label>
    </div><label className="publish-check"><input type="checkbox" checked={editing.published} onChange={e=>setEditing({...editing,published:e.target.checked})}/><span>Publicar na agenda<small>Desmarque para manter como rascunho.</small></span></label>{formError&&<p role="alert" className="admin-error">{formError}</p>}<div className="form-actions"><button className="primary" type="submit" disabled={!!error}><Save size={16}/>Salvar partida</button><button type="button" className="admin-secondary" onClick={()=>setEditing(null)}>Cancelar edição</button></div></form>:<><div className="section-heading"><h2>Gerenciar partidas</h2><button className="primary new-match" disabled={!!error} onClick={()=>edit(blank())}><Plus size={16}/>Novo jogo</button></div><div className="filters admin-filters"><label className="search"><input aria-label="Buscar partidas na administração" placeholder="Buscar adversário ou local…" value={query} onChange={e=>setQuery(e.target.value)}/></label><select aria-label="Filtrar publicação" value={visibility} onChange={e=>setVisibility(e.target.value)}><option>Todos</option><option>Publicados</option><option>Rascunhos</option></select></div><div className="admin-list">{listed.map(match=><article className="admin-match" key={match.id}><div className="admin-match-date"><strong>{matchDate(match.date).day}</strong><span>{matchDate(match.date).month}</span></div><div className="admin-match-info"><span className="admin-competition">{match.competition}</span><h3>{match.home?`Alianza Minas × ${match.opponent}`:`${match.opponent} × Alianza Minas`}</h3><p>{matchDate(match.date).full} · {match.status==='Adiado'?'Horário a definir':matchDate(match.date).time} · {match.venue}</p><div className="admin-badges"><span className={match.published?'published':'draft'}>{match.published?'Publicado':'Rascunho'}</span><span className={`status ${match.status.toLowerCase()}`}>{match.status}</span></div></div><div className="admin-row-actions"><button className="admin-secondary" onClick={()=>edit(match)}><FilePenLine size={14}/>Editar</button><button disabled={!!error} className="text-button" onClick={()=>toggle(match)}>{match.published?'Retirar da agenda':'Publicar'}</button></div></article>)}</div>{!listed.length&&<div className="empty"><h3>Nenhuma partida encontrada.</h3><p>Cadastre um jogo ou ajuste os filtros.</p></div>}</>}
    <div className="admin-roadmap"><h3>Próximos módulos</h3><p>Gestão de membros, elenco, resultados e votações serão conectados ao banco na próxima etapa. Este painel já permite validar o fluxo de administração da agenda.</p></div>
  </section>;
}


