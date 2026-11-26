import { useEffect, useState } from 'react';
import { listPlayers, type Player } from './lib/players';
import { readMatches, storageKey, type ManagedMatch } from './lib/store';
import { listMatches, listOpponents, listRemotePlayers, saveMatch, saveOpponent, saveRemotePlayer, errorMessage } from './lib/remote';

async function stableId(kind: string, value: string) {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) return value;
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(`alianza:${kind}:${value}`)));
  bytes[6]=(bytes[6]&15)|80; bytes[8]=(bytes[8]&63)|128;
  const hex=Array.from(bytes.slice(0,16),b=>b.toString(16).padStart(2,'0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
export default function Migration() {
  const [players,setPlayers]=useState<Player[]>([]); const [matches,setMatches]=useState<ManagedMatch[]>([]);
  const [busy,setBusy]=useState(false); const [error,setError]=useState(''); const [message,setMessage]=useState('');
  useEffect(()=>{void (async()=>{try{
    if((await indexedDB.databases()).some(db=>db.name==='alianza-players'))setPlayers(await listPlayers());
    if(localStorage.getItem(storageKey)!==null)setMatches(readMatches());
  }catch(e){setError(errorMessage(e));}})();},[]);
  function backup(){const url=URL.createObjectURL(new Blob([JSON.stringify({exportedAt:new Date().toISOString(),players,matches},null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='alianza-backup-local.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  async function run(action:()=>Promise<string>){setBusy(true);setError('');setMessage('');try{setMessage(await action());}catch(e){setError(errorMessage(e));}finally{setBusy(false);}}
  async function importPlayer(player:Player){
    const id=await stableId('player',player.id);
    if((await listRemotePlayers(true)).some(p=>p.id===id))return 'Jogador já existe online. Não foi sobrescrito.';
    return saveRemotePlayer({...player,id,version:undefined,photoPath:null});
  }
  async function importMatch(match:ManagedMatch){
    const id=await stableId('match',match.id);
    if((await listMatches(true)).some(m=>m.id===id))return 'Jogo já existe online. Não foi sobrescrito.';
    const normalized=match.opponent.trim().toLocaleLowerCase();
    const teams=await listOpponents();let opponentId=teams.find(o=>o.name.trim().toLocaleLowerCase()===normalized)?.id;
    if(!opponentId){opponentId=await stableId('opponent',normalized);await saveOpponent({id:opponentId,name:match.opponent,initials:match.initials,color:match.color,city:'',active:true});}
    await saveMatch({...match,id,opponentId,published:false,version:undefined});return 'Jogo importado como rascunho. Revise e publique em Jogos.';
  }
  return <section className="admin-page"><h1>Dados deste navegador</h1><p className="admin-notice">Os registros antigos continuam preservados aqui. Importe somente os cadastros desejados; os exemplos não são enviados automaticamente. Jogos entram como rascunho.</p>
    <button className="admin-secondary" disabled={busy} onClick={backup}>Baixar cópia dos dados locais e fotos</button>
    {error&&<p role="alert" className="admin-error">{error}</p>}{message&&<p role="status" className="admin-success">{message}</p>}
    <h2>Jogadores locais</h2><div className="admin-list">{players.map(p=><article className="admin-match" key={p.id}><div className="admin-match-info"><h3>{p.name}</h3><p>{p.position}{p.id.startsWith('example-')?' · Exemplo da demonstração':''}</p></div><button className="admin-secondary" disabled={busy} onClick={()=>void run(()=>importPlayer(p))}>Importar jogador</button></article>)}</div>
    <h2>Jogos locais</h2><div className="admin-list">{matches.map(m=><article className="admin-match" key={m.id}><div className="admin-match-info"><h3>{m.opponent}</h3><p>{m.date.slice(0,10)} · {m.venue}</p></div><button className="admin-secondary" disabled={busy} onClick={()=>void run(()=>importMatch(m))}>Importar rascunho</button></article>)}</div>
    {!players.length&&!matches.length&&<p className="empty">Não há cadastros locais salvos neste navegador.</p>}
  </section>;
}
