import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, Plus, Shirt, Trash2, Upload } from 'lucide-react';
import { deletePlayer, listPlayers, positions, preparePhoto, savePlayer, type Player } from './lib/players';
import './players.css';

type Props = { admin?: boolean; navigate: (path: string) => void };

export default function Players({ admin = false, navigate }: Props) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [query, setQuery] = useState('');
  const [position, setPosition] = useState('Todos');
  const [editing, setEditing] = useState<Player | null>(null);
  const [deleting, setDeleting] = useState<Player | null>(null);
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const photoRequest = useRef(0);
  const dialog = useRef<HTMLDialogElement>(null);

  async function refresh() {
    try { setPlayers(await listPlayers()); }
    catch (cause) { setError((cause as Error).message); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    void refresh();
    const reload = () => { void refresh(); };
    window.addEventListener('focus', reload);
    window.addEventListener('players-changed', reload);
    return () => {
      window.removeEventListener('focus', reload);
      window.removeEventListener('players-changed', reload);
      photoRequest.current++;
    };
  }, []);

  useEffect(() => {
    if (deleting) dialog.current?.showModal();
    else dialog.current?.close();
  }, [deleting]);

  function edit(player: Player) {
    photoRequest.current++;
    setPhotoBusy(false);
    setEditing({ ...player });
    setError('');
    setMessage('');
  }

  async function upload(file?: File) {
    if (!file) return;
    const request = ++photoRequest.current;
    setPhotoBusy(true);
    setError('');
    try {
      const photo = await preparePhoto(file);
      if (request === photoRequest.current) setEditing(current => current ? { ...current, photo } : null);
    } catch (cause) {
      if (request === photoRequest.current) setError((cause as Error).message);
    } finally {
      if (request === photoRequest.current) setPhotoBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing || busy || photoBusy) return;
    setBusy(true);
    setError('');
    try {
      await savePlayer(editing);
      await refresh();
      setEditing(null);
      setMessage('Jogador salvo. O elenco já foi atualizado neste navegador.');
    } catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  }

  async function remove() {
    if (!deleting || busy) return;
    setBusy(true);
    setError('');
    try {
      await deletePlayer(deleting.id);
      setMessage(`${deleting.name} foi excluído do cadastro local.`);
      setDeleting(null);
      await refresh();
    } catch (cause) { setError((cause as Error).message); setDeleting(null); }
    finally { setBusy(false); }
  }

  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const visible = players.filter(player => (admin || player.active) && normalize(player.name).includes(normalize(query)) && (position === 'Todos' || player.position === position));

  return <section className="players-page">
    {admin && <button className="text-button" onClick={() => navigate('/admin')}><ArrowLeft size={16}/>Administração da agenda</button>}
    <div className="section-heading">
      <div><div className="eyebrow">{admin ? 'ADMINISTRAÇÃO' : 'ÁREA DO TIME · PRÉVIA'}</div><h1>{admin ? 'Gerenciar jogadores' : 'Nosso elenco'}</h1></div>
      {admin && <button className="primary new-match" disabled={loading || busy} onClick={() => edit({ id: crypto.randomUUID(), name: '', number: 1, position: 'Goleiro', active: true, photo: null })}><Plus size={16}/>Novo jogador</button>}
    </div>
    <p className="admin-notice">Cadastro e fotos ficam neste navegador. Acesso protegido e sincronização com o time serão integrados ao banco. Use dados de teste nesta prévia.</p>
    {error && <p role="alert" className="admin-error">{error}</p>}
    {message && <p role="status" className="admin-success">{message}</p>}
    {editing ? <form className="admin-form player-form" onSubmit={submit}>
      <h2>{players.some(player => player.id === editing.id) ? 'Editar jogador' : 'Cadastrar jogador'}</h2>
      <fieldset disabled={busy}>
        <div className="photo-editor">
          {editing.photo ? <img src={editing.photo} alt={`Prévia da foto de ${editing.name || 'jogador'}`}/> : <div className="photo-placeholder"><Shirt size={65}/></div>}
          <div><label className="photo-label"><Upload size={16}/>Selecionar foto<input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => { void upload(event.target.files?.[0]); event.target.value = ''; }}/></label><p>JPG, PNG ou WebP, até 5 MB. Prefira um retrato com uniforme. A imagem será otimizada ao salvar.</p>{photoBusy && <p role="status">Preparando foto…</p>}{editing.photo && <button type="button" className="text-button" onClick={() => { photoRequest.current++; setPhotoBusy(false); setEditing({ ...editing, photo: null }); }}>Remover foto</button>}</div>
        </div>
        <div className="form-grid">
          <label>Nome completo *<input required autoComplete="name" maxLength={120} value={editing.name} onChange={event => setEditing({ ...editing, name: event.target.value })}/></label>
          <label>CPF<input inputMode="numeric" placeholder="000.000.000-00" maxLength={14} value={editing.cpf ?? ''} onChange={event => setEditing({ ...editing, cpf: event.target.value })}/></label>
          <label>E-mail<input type="email" autoComplete="email" maxLength={254} value={editing.email ?? ''} onChange={event => setEditing({ ...editing, email: event.target.value })}/></label>
          <label className="full-field">Endereço<textarea autoComplete="street-address" rows={3} maxLength={500} placeholder="Rua, número, complemento, bairro, cidade, estado e CEP" value={editing.address ?? ''} onChange={event => setEditing({ ...editing, address: event.target.value })}/></label>
          <label>Contato de emergência — nome<input maxLength={120} value={editing.emergencyContactName ?? ''} onChange={event => setEditing({ ...editing, emergencyContactName: event.target.value })}/></label>
          <label>Contato de emergência — telefone<input type="tel" placeholder="(31) 99999-9999" maxLength={25} value={editing.emergencyContactPhone ?? ''} onChange={event => setEditing({ ...editing, emergencyContactPhone: event.target.value })}/></label>
          <label>Número da camisa *<input required type="number" min={1} max={99} step={1} value={editing.number || ''} onChange={event => setEditing({ ...editing, number: Number(event.target.value) })}/></label>
          <label>Posição *<select value={editing.position} onChange={event => setEditing({ ...editing, position: event.target.value })}>{positions.map(value => <option key={value}>{value}</option>)}</select></label>
          <label>Situação<select value={editing.active ? 'active' : 'inactive'} onChange={event => setEditing({ ...editing, active: event.target.value === 'active' })}><option value="active">Ativo · aparece no elenco</option><option value="inactive">Inativo · somente administração</option></select></label>
        </div>
        <div className="form-actions"><button className="primary" disabled={photoBusy || busy}>{busy ? 'Salvando…' : 'Salvar jogador'}</button><button type="button" className="admin-secondary" onClick={() => { photoRequest.current++; setPhotoBusy(false); setEditing(null); setError(''); }}>Cancelar</button></div>
      </fieldset>
    </form> : <>
      <div className="filters"><label className="search"><input aria-label="Buscar jogador" placeholder="Buscar jogador…" value={query} onChange={event => setQuery(event.target.value)}/></label><select aria-label="Filtrar posição" value={position} onChange={event => setPosition(event.target.value)}><option>Todos</option>{positions.map(value => <option key={value}>{value}</option>)}</select></div>
      {loading ? <p role="status" className="empty">Carregando jogadores…</p> : <>
        <p className="result-count" aria-live="polite">{visible.length} jogadores encontrados</p>
        <div className="roster-grid">{visible.map(player => <article className="roster-card" key={player.id}>
          <div className="roster-photo">{player.photo ? <img src={player.photo} alt={player.name} loading="lazy"/> : <Shirt size={80}/>}<strong>#{player.number}</strong></div>
          <div className="roster-info"><span>{player.position}{!player.active && ' · Inativo'}</span><h2>{player.name}</h2>{admin && <div className="roster-actions"><button className="admin-secondary" onClick={() => edit(player)}>Editar {player.name}</button><button className="text-button" aria-label={`Excluir ${player.name}`} onClick={() => setDeleting(player)}><Trash2 size={16}/></button></div>}</div>
        </article>)}</div>
        {!visible.length && <div className="empty">Nenhum jogador encontrado. Ajuste os filtros ou cadastre um jogador.</div>}
      </>}
    </>}
    <dialog ref={dialog} onCancel={event => { if (busy) event.preventDefault(); else setDeleting(null); }} aria-labelledby="delete-player-title">
      <h2 id="delete-player-title">Excluir {deleting?.name}?</h2><p className="delete-description">O cadastro e a foto serão removidos deste navegador. Você também pode cancelar e marcar o jogador como inativo para preservar o cadastro.</p><div className="form-actions"><button className="admin-secondary" disabled={busy} onClick={() => setDeleting(null)}>Cancelar</button><button className="primary" disabled={busy} onClick={() => void remove()}>{busy ? 'Excluindo…' : 'Confirmar exclusão'}</button></div>
    </dialog>
  </section>;
}
