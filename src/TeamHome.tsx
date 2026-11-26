import {useEffect,useState} from 'react';
import {CalendarDays,Users,Star,ChartNoAxesCombined,Trophy,Goal,Shield,Settings,ChevronRight,Clock3,MapPin} from 'lucide-react';
import {listMatches,errorMessage} from './lib/remote';
import {matchDate} from './lib/agenda';
import type {ManagedMatch} from './lib/store';

export default function TeamHome({name,admin,navigate}:{name:string;admin:boolean;navigate:(path:string)=>void}){
  const [games,setGames]=useState<ManagedMatch[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[revision,setRevision]=useState(0),[failedCrest,setFailedCrest]=useState(false);
  useEffect(()=>{let alive=true;const refresh=()=>{void listMatches().then(data=>{if(alive){setGames(data);setError('');setLoading(false);}}).catch(e=>{if(alive){setError(errorMessage(e));setLoading(false);}});};refresh();const timer=setInterval(refresh,60000);window.addEventListener('focus',refresh);return()=>{alive=false;clearInterval(timer);window.removeEventListener('focus',refresh);};},[revision]);
  const next=games.filter(g=>g.status==='Agendado'&&Date.parse(g.date)>=Date.now()).sort((a,b)=>Date.parse(a.date)-Date.parse(b.date))[0];
  useEffect(()=>setFailedCrest(false),[next?.crest]);
  const finished=games.filter(g=>g.status==='Finalizado');
  const metrics=[{label:'Jogos',value:finished.length,Icon:Trophy},{label:'Gols pró',value:finished.reduce((n,g)=>n+(g.goalsFor??0),0),Icon:Goal},{label:'Gols contra',value:finished.reduce((n,g)=>n+(g.goalsAgainst??0),0),Icon:Shield},{label:'Vitórias',value:finished.filter(g=>(g.goalsFor??0)>(g.goalsAgainst??0)).length,Icon:ChartNoAxesCombined}];
  const shortcuts=[{label:'Agenda de jogos',Icon:CalendarDays,action:()=>navigate('/agenda')},{label:'Elenco',Icon:Users,action:()=>navigate('/time/elenco')},{label:'Estatísticas',Icon:ChartNoAxesCombined,action:()=>document.getElementById('team-stats')?.scrollIntoView({behavior:'smooth',block:'center'})},{label:'Craque da semana',Icon:Star,action:()=>navigate('/time/votacoes')},...(admin?[{label:'Administração',Icon:Settings,action:()=>navigate('/admin')}]:[])];
  return <section className="team-home"><div className="home-welcome"><h1>Início</h1><p>Bem-vindo, {name}.</p></div>
    {error&&<div role="alert" className="admin-error">{error}<button className="text-button" onClick={()=>setRevision(r=>r+1)}>Tentar novamente</button></div>}
    <article className="next-game"><div className="next-game-heading"><h2><CalendarDays/>Próximo confronto</h2>{next&&<span><Trophy/>{next.competition}</span>}</div>
      {loading?<p className="home-empty" role="status">Carregando próximo confronto…</p>:next?<><div className="next-game-teams"><div><img src="/alianza-logo.png" alt="Escudo do Alianza Minas"/><strong>Alianza Minas</strong></div><b className="next-vs">VS</b><div>{next.crest&&!failedCrest?<img src={next.crest} alt={`Escudo de ${next.opponent}`} onError={()=>setFailedCrest(true)}/>:<span className="next-initials">{next.initials}</span>}<strong>{next.opponent}</strong></div></div><div className="next-game-details"><span><CalendarDays/>{new Date(next.date).toLocaleDateString('pt-BR',{timeZone:'America/Sao_Paulo'})}</span><span><Clock3/>{matchDate(next.date).time}</span><span><MapPin/>{next.venue}</span></div><p className="home-match-note">{next.home?'Mando do Alianza Minas':'Fora de casa'} · Horário de Brasília</p></>:!error&&<p className="home-empty">Aguardando a publicação do próximo confronto.</p>}
    </article>
    <section id="team-stats" className="home-stat-section" aria-label="Estatísticas do time"><div className="home-stats">{metrics.map(({label,value,Icon})=><article key={label}><Icon/><strong>{loading||error?'—':value}</strong><span>{label}</span></article>)}</div><p>Totais dos jogos publicados e finalizados · todas as temporadas</p></section>
    <nav className="home-shortcuts" aria-label="Atalhos do time">{shortcuts.map(({label,Icon,action})=><button key={label} onClick={action}><Icon/><strong>{label}</strong><ChevronRight className="shortcut-arrow"/></button>)}</nav>
  </section>;
}
