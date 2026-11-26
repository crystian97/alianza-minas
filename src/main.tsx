import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Home, Users, Star, Settings, ArrowDown, ArrowRight, CalendarDays, Check, Clock3, LockKeyhole, MapPin, Search, Shield, Trophy, X } from 'lucide-react';
import Players from './Players';
import Admin, { AdminNav } from './Admin';
import Opponents from './Opponents';
import Migration from './Migration';
import Voting from './Voting';
import AdminMembers from './AdminMembers';
import AdminParticipations from './AdminParticipations';
import AdminPolls from './AdminPolls';
import { Signup, ForgotPassword, ResetPassword } from './Account';
import { Login, useAuth } from './auth';
import { getSupabase } from './lib/supabase';
import { listMatches, errorMessage } from './lib/remote';
import { availableFilter, filterMatches, matchDate, type Match } from './lib/agenda';
import type { ManagedMatch } from './lib/store';
import './styles.css';
import './admin.css';
import './theme.css';
import TeamHome from './TeamHome';

function Crest({small=false, initials='AM', color, image, club=true}: {small?:boolean; initials?:string; color?:string;image?:string|null;club?:boolean}) {
  const [failed,setFailed]=useState(false);
  useEffect(()=>setFailed(false),[image]);
  if(club)return <span className={`crest alianza club-logo ${small?'small':''}`}><img src="/alianza-logo.png" alt="Escudo do Alianza Minas" width={150} height={150}/></span>;
  if(image&&!failed)return <img className="team-crest" src={image} alt="" onError={()=>setFailed(true)}/>;
  return <div aria-hidden="true" className={`crest ${small?'small':''} ${initials==='AM'?'alianza':''}`} style={color?{borderColor:color,background:`${color}20`}:undefined}><Shield/><b>{initials}</b>{!small&&<span>{initials==='AM'?'MINAS':'FUTEBOL CLUBE'}</span>}</div>;
}
function MatchRow({match,onSelect}:{match:Match;onSelect:(match:Match)=>void}){
  const date=matchDate(match.date);
  return <button className="match-row" onClick={()=>onSelect(match)}><div className="date-block"><span>{date.weekday}</span><strong>{date.day}</strong><span>{date.month}</span></div><div className="match-content"><div className="match-tags"><span>{match.competition}</span><span className={`status ${match.status.toLowerCase()}`}>{match.status}</span></div><div className="teams"><div><Crest small club={match.home} initials={match.home?'AM':match.initials} color={match.home?undefined:match.color} image={match.home?undefined:match.crest}/><b>{match.home?'Alianza Minas':match.opponent}</b></div><span className="versus">{match.status==='Finalizado'?`${match.home?match.goalsFor:match.goalsAgainst} × ${match.home?match.goalsAgainst:match.goalsFor}`:'×'}</span><div><Crest small club={!match.home} initials={match.home?match.initials:'AM'} color={match.home?match.color:undefined} image={match.home?match.crest:undefined}/><b>{match.home?match.opponent:'Alianza Minas'}</b></div></div><div className="match-meta"><span><Clock3 size={14}/>{match.status==='Adiado'?'Horário a definir':date.time}</span><span><MapPin size={14}/>{match.venue}</span><span>{match.home?'Em casa':'Fora de casa'}</span></div></div></button>;
}
function Agenda({navigate}:{navigate:(path:string)=>void}){
  const [matches,setMatches]=useState<ManagedMatch[]>([]);const [loading,setLoading]=useState(true);const [error,setError]=useState('');
  const [query,setQuery]=useState('');const [competition,setCompetition]=useState('Todos');const [month,setMonth]=useState('Todos');const [revision,setRevision]=useState(0);
  const [selected,setSelected]=useState<Match|null>(null);const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{let alive=true;const refresh=()=>{void listMatches().then(data=>{if(alive){setMatches(data);setError('');setLoading(false);}}).catch(e=>{if(alive){setError(errorMessage(e));setLoading(false);}});};refresh();window.addEventListener('focus',refresh);const timer=window.setInterval(refresh,60_000);return()=>{alive=false;window.removeEventListener('focus',refresh);window.clearInterval(timer);};},[revision]);
  useEffect(()=>{if(selected)dialog.current?.showModal();else dialog.current?.close();},[selected]);
  const competitions=Array.from(new Set(matches.map(m=>m.competition)));
  // A API retorna UTC; mês e horário exibidos seguem Brasília.
  const normalized=matches.map(m=>({...m,date:new Date(new Date(m.date).getTime()-10800000).toISOString().slice(0,-1)+'-03:00'}));
  const months=Array.from(new Set(normalized.map(m=>m.date.slice(0,7)))).sort();
  const activeCompetition=availableFilter(competition,competitions);const activeMonth=availableFilter(month,months);
  const filtered=filterMatches(normalized,query,activeCompetition,activeMonth);
  return <><section className="hero"><div className="hero-copy"><div className="eyebrow">UNIÃO · RESPEITO · CONQUISTAS</div><h1>ALIANZA<br/><em>MINAS</em></h1><p>Acompanhe a agenda do Alianza Minas.<br/>Cada encontro, uma nova chance de fazer história.</p><a className="hero-link" href="#games">Confira os confrontos <ArrowDown size={17}/></a></div><div className="hero-art" aria-hidden="true"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><Crest/><span className="art-caption">UNIÃO. RESPEITO. CONQUISTAS.</span></div></section>
    <div className="season-strip"><span><Trophy size={17}/> ALIANZA MINAS</span><span><span className="green-dot"/>A agenda é aberta a todos</span><span>Futebol que nos une.</span></div>
    <div className="agenda-layout"><section id="games"><div className="section-heading"><div className="heading-with-icon"><CalendarDays size={23}/><h2>Agenda de jogos</h2></div><span>Horário de Brasília</span></div>
      <div className="competition-tabs">{['Todos',...competitions].map(c=><button key={c} className={activeCompetition===c?'selected':''} onClick={()=>setCompetition(c)}>{c==='Todos'?'Todos os jogos':c}</button>)}</div>
      <div className="filters"><label className="search"><Search size={18}/><input aria-label="Buscar adversário ou local" placeholder="Buscar adversário ou local…" value={query} onChange={e=>setQuery(e.target.value)}/></label><select aria-label="Filtrar mês" value={activeMonth} onChange={e=>setMonth(e.target.value)}><option value="Todos">Todos os meses</option>{months.map(m=><option key={m} value={m}>{new Date(`${m}-01T12:00:00-03:00`).toLocaleDateString('pt-BR',{month:'long',year:'numeric',timeZone:'America/Sao_Paulo'})}</option>)}</select></div>
      {error&&<div className="admin-error" role="alert">{error}<button className="text-button" onClick={()=>setRevision(v=>v+1)}>Tentar novamente</button></div>}
      {loading?<p role="status">Carregando agenda online…</p>:<><p className="result-count">{filtered.length} confrontos encontrados</p><div className="match-list">{filtered.map(m=><MatchRow key={m.id} match={m} onSelect={setSelected}/>)}</div>{!filtered.length&&!error&&<div className="empty"><Search size={30}/><h3>{matches.length?'Nenhum confronto com esses filtros.':'Aguardando os próximos confrontos.'}</h3><p>{matches.length?'Ajuste a busca para encontrar os jogos.':'Os jogos aparecerão aqui quando forem publicados pelo administrador.'}</p><button className="text-button" onClick={()=>{setQuery('');setMonth('Todos');setCompetition('Todos');}}>Limpar filtros</button></div>}</>}
    </section><aside><div className="team-card"><div className="eyebrow">MUITO ALÉM DOS 90 MINUTOS</div><Crest/><h2>Uma camisa.<br/>Uma família.</h2><p>O espaço de quem constrói o Alianza dentro e fora de campo.</p><button onClick={()=>navigate('/time')}>Acessar área do time <ArrowRight size={17}/></button></div><div className="info-card"><CalendarDays size={22}/><h3>Fique de olho na agenda</h3><p>Datas e locais podem mudar. Confira os detalhes antes de sair para o jogo.</p><span><Check size={14}/>Atualizações em um só lugar</span></div></aside></div>
    <dialog ref={dialog} onCancel={()=>setSelected(null)} onClick={e=>{if(e.target===dialog.current)setSelected(null);}}>{selected&&<><button className="close-dialog" aria-label="Fechar detalhes" onClick={()=>setSelected(null)}><X/></button><div className="eyebrow">{selected.competition}</div><h2>Alianza Minas × {selected.opponent}</h2><p>{selected.status}</p><dl><div><dt>Data</dt><dd>{matchDate(selected.date).full}</dd></div><div><dt>Horário</dt><dd>{selected.status==='Adiado'?'A definir':matchDate(selected.date).time} · Brasília</dd></div><div><dt>Local</dt><dd>{selected.venue}</dd></div><div><dt>Mando</dt><dd>{selected.home?'Alianza Minas':selected.opponent}</dd></div></dl>{selected.status==='Finalizado'&&<h3>Placar: {selected.goalsFor} × {selected.goalsAgainst}</h3>}{selected.note&&<p className="dialog-note">{selected.note}</p>}</>}</dialog>
  </>;
}
function App(){
  const [page,setPage]=useState(location.pathname.replace(/^\/demo/,'/time'));const auth=useAuth();const [error,setError]=useState('');
  function navigate(path:string){history.pushState({},'',path);setPage(path);window.scrollTo(0,0);}
  useEffect(()=>{const pop=()=>setPage(location.pathname.replace(/^\/demo/,'/time'));window.addEventListener('popstate',pop);return()=>window.removeEventListener('popstate',pop);},[]);
  useEffect(()=>{document.title=`Alianza Minas · ${page.startsWith('/admin')?'Administração':page.startsWith('/time')?'Área do time':'Agenda de jogos'}`;},[page]);
  const privatePage=page.startsWith('/admin')||page.startsWith('/time');const admin=auth.profile?.active&&auth.profile.role==='admin';
  let content;
  if(auth.recovering||page==='/recuperar')content=<ResetPassword ready={Boolean(auth.session)} onDone={()=>{auth.finishRecovery();navigate('/time');}}/>;
  else if(page==='/cadastro')content=<Signup navigate={navigate}/>;
  else if(page==='/esqueci-senha')content=<ForgotPassword navigate={navigate}/>;
  else if(page==='/entrar'||(privatePage&&!auth.profile?.active)) content=<Login auth={auth} navigate={navigate}/>;
  else if(page.startsWith('/admin')&&!admin)content=<section className="empty"><h1>Acesso exclusivo da administração</h1><button className="primary" onClick={()=>navigate('/time')}>Voltar ao time</button></section>;
  else if(page.startsWith('/admin'))content=<><AdminNav navigate={navigate}/>{page==='/admin/jogadores'?<Players admin navigate={navigate}/>:page==='/admin/adversarios'?<Opponents/>:page==='/admin/migracao'?<Migration/>:page==='/admin/usuarios'?<AdminMembers onChanged={auth.refresh}/>:page==='/admin/participacoes'?<AdminParticipations/>:page==='/admin/votacoes'?<AdminPolls navigate={navigate}/>:<Admin navigate={navigate}/>}</>;
  else if(page==='/time')content=<TeamHome name={auth.profile?.display_name??''} admin={Boolean(admin)} navigate={navigate}/>;
  else if(page.startsWith('/time'))content=<><div className="internal-heading"><div><div className="eyebrow">ÁREA DO TIME</div><h1>Somos <em>Alianza.</em></h1><p>Bem-vindo, {auth.profile?.display_name}.</p></div><Crest/></div><nav className="internal-tabs"><button onClick={()=>navigate('/time/elenco')}>Elenco</button><button onClick={()=>navigate('/time/votacoes')}>Craque da semana</button>{admin&&<button onClick={()=>navigate('/admin')}>Administração</button>}</nav>{page==='/time/votacoes'?<Voting canVote={auth.profile?.role==='player'||auth.profile?.role==='staff'}/>:<Players navigate={navigate}/>}</>;
  else content=<Agenda navigate={navigate}/>;
  return <><a className="skip" href="#content">Pular para o conteúdo</a><header><button className="brand" onClick={()=>navigate('/agenda')} aria-label="Alianza Minas, agenda"><Crest small/><span>ALIANZA <b>MINAS</b><small>UNIÃO · RESPEITO · CONQUISTAS</small></span></button><nav aria-label="Navegação principal"><button onClick={()=>navigate('/agenda')}><CalendarDays size={17}/>Agenda pública</button><button className="member-button" onClick={()=>navigate('/time')}><LockKeyhole size={15}/>Área do time</button>{admin&&<button onClick={()=>navigate('/admin')}>Administração</button>}{auth.session&&<button onClick={async()=>{const result=await getSupabase().auth.signOut({scope:'local'});if(result.error)setError(errorMessage(result.error));else{setError('');navigate('/agenda');}}}>Sair</button>}</nav></header><main id="content"><section className="club-banner" aria-label="Alianza Minas"><Crest/><div><span>UNIÃO · RESPEITO · CONQUISTAS</span><h2>ALIANZA <em>MINAS</em></h2><p>Um time. Uma família. Uma paixão.</p></div><Trophy className="banner-trophy" aria-hidden="true"/></section>{error&&<p className="admin-error" role="alert">{error}</p>}<React.Fragment key={`${auth.session?.user.id??'public'}-${auth.profile?.role??'none'}-${page}`}>{content}</React.Fragment></main><nav className="mobile-dock" aria-label="Navegação rápida"><button aria-current={page==="/time"?"page":undefined} onClick={()=>navigate("/time")}><Home/>Início</button><button aria-current={!privatePage?"page":undefined} onClick={()=>navigate("/agenda")}><CalendarDays/>Jogos</button><button aria-current={page==="/time/elenco"?"page":undefined} onClick={()=>navigate("/time/elenco")}><Users/>Elenco</button><button aria-current={page==="/time/votacoes"?"page":undefined} onClick={()=>navigate("/time/votacoes")}><Star/>Craque</button><button aria-current={page.startsWith("/admin")?"page":undefined} onClick={()=>navigate(admin?"/admin":"/entrar")}>{admin?<Settings/>:<LockKeyhole/>}{admin?"Painel":"Acesso"}</button></nav><footer><span>ALIANZA <b>MINAS</b></span><p>União · Respeito · Conquistas</p></footer></>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
