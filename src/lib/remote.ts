import { getSupabase } from './supabase';
import { validatePlayer, type Player } from './players';
import type { ManagedMatch } from './store';

export function errorMessage(cause: unknown): string {
  const e = cause as { code?: string; message?: string };
  if (['23503', '23001'].includes(e?.code ?? '')) return 'Este cadastro tem histórico vinculado. Prefira inativar ou cancelar em vez de excluir.';
  if (e?.code === '23505') return 'Já existe um cadastro com esse identificador ou CPF. Recarregue para conferir.';
  if (e?.code === '42501') return 'Seu acesso não permite esta operação. Entre novamente ou fale com o administrador.';
  if (e?.code === 'PGRST202' || e?.code === '42703') return 'O banco precisa das migrações mais recentes (etapas 3 e 4). Confira os scripts do Supabase.';
  if (e?.code === '40001') return 'Este cadastro mudou em outra sessão. Recarregue a lista antes de editar novamente.';
  if (e?.message?.includes('Failed to fetch')) return 'Não foi possível conectar ao banco. Confira sua conexão e tente novamente.';
  return e?.message || 'Não foi possível concluir a operação.';
}
function check(error: unknown) { if (error) throw new Error(errorMessage(error)); }
export type Opponent = { id: string; name: string; initials: string; color: string; city: string; active: boolean; version?: number; crest_path?: string | null };

export async function listOpponents(): Promise<Opponent[]> {
  const { data, error } = await getSupabase().from('opponents').select('*').order('name');
  check(error); return data ?? [];
}
export function opponentCrest(path?: string | null) {
  return path ? getSupabase().storage.from('opponent-crests').getPublicUrl(path).data.publicUrl : null;
}
export async function saveOpponent(value: Opponent, crest?: string | null) {
  if (!value.name.trim() || !value.initials.trim()) throw new Error('Preencha nome e sigla.');
  let path = crest === null ? null : value.crest_path ?? null;
  if (crest) {
    if (!crest.startsWith('data:image/')) throw new Error('Escudo inválido.');
    const blob = await (await fetch(crest)).blob();
    if (!['image/webp','image/png','image/jpeg'].includes(blob.type) || blob.size > 5*1024*1024) throw new Error('Use JPG, PNG ou WebP de até 5 MB.');
    const extension = blob.type === 'image/png' ? 'png' : blob.type === 'image/jpeg' ? 'jpg' : 'webp';
    path = `opponents/${value.id}/${crypto.randomUUID()}.${extension}`;
    const uploaded = await getSupabase().storage.from('opponent-crests').upload(path,blob,{contentType:blob.type,upsert:false});
    check(uploaded.error);
  }
  const { version, ...fields } = value;
  const payload = { ...fields, crest_path:path, name: value.name.trim(), initials: value.initials.trim().toUpperCase(), city: value.city.trim() };
  const table = getSupabase().from('opponents');
  const { data, error } = await (version ? table.update(payload).eq('id', value.id).eq('version', version) : table.insert(payload)).select('id');
  check(error); if (!data?.length) throw new Error('Adversário alterado por outra pessoa. Recarregue a lista.');
  // Não apagar upload em erro de rede: o cadastro pode ter sido confirmado.
  if(value.crest_path && value.crest_path!==path){
    const removed=await getSupabase().storage.from('opponent-crests').remove([value.crest_path]);
    if(removed.error)return 'Adversário salvo. A limpeza do escudo anterior ficou pendente.';
  }
  return 'Adversário salvo online.';
}
export async function deleteOpponent(value: Opponent) {
  const { data, error } = await getSupabase().from('opponents').delete().eq('id', value.id).eq('version', value.version).select('id');
  check(error); if (!data?.length) throw new Error('Adversário alterado ou sem permissão. Recarregue a lista.');
  if(value.crest_path){const removed=await getSupabase().storage.from('opponent-crests').remove([value.crest_path]);if(removed.error)return 'Adversário excluído. A limpeza do escudo ficou pendente.';}
  return 'Adversário excluído.';
}
export async function listMatches(admin = false): Promise<ManagedMatch[]> {
  let query = getSupabase().from('matches').select('*, opponents(id,name,initials,color,crest_path)').order('starts_at');
  if (!admin) query = query.eq('published', true);
  const { data, error } = await query; check(error);
  return (data ?? []).map(row => ({ id: row.id, opponentId: row.opponent_id, opponent: row.opponents?.name ?? 'Adversário',
    initials: row.opponents?.initials ?? 'ADV', color: row.opponents?.color ?? '#a63b59',
    crest: row.opponents?.crest_path ? getSupabase().storage.from('opponent-crests').getPublicUrl(row.opponents.crest_path).data.publicUrl : null,
    date: row.starts_at, venue: row.venue, competition: row.competition, home: row.home, status: row.status,
    published: row.published, note: row.note, goalsFor: row.goals_for, goalsAgainst: row.goals_against, version: row.version }));
}
export async function saveMatch(value: ManagedMatch) {
  if (!value.opponentId || !value.venue.trim() || !value.competition.trim()) throw new Error('Preencha adversário, local e competição.');
  const payload = { id: value.id, opponent_id: value.opponentId, starts_at: value.date, venue: value.venue.trim(), competition: value.competition.trim(),
    home: value.home, status: value.status, published: value.published, note: value.note?.trim() ?? '',
    goals_for: value.status === 'Finalizado' ? value.goalsFor : null, goals_against: value.status === 'Finalizado' ? value.goalsAgainst : null };
  const table = getSupabase().from('matches');
  const { data, error } = await (value.version ? table.update(payload).eq('id', value.id).eq('version', value.version) : table.insert(payload)).select('id');
  check(error); if (!data?.length) throw new Error('Partida alterada por outra pessoa. Recarregue a lista.');
}
export async function deleteMatch(value: ManagedMatch) {
  const { data, error } = await getSupabase().from('matches').delete().eq('id', value.id).eq('version', value.version).select('id');
  check(error); if (!data?.length) throw new Error('Partida alterada ou sem permissão. Recarregue a lista.');
}
export async function listRemotePlayers(admin = false): Promise<Player[]> {
  let query = getSupabase().from('players').select('*').order('number');
  if (!admin) query = query.eq('active', true);
  const { data, error } = await query; check(error);
  const details = new Map<string, Record<string, string>>();
  if (admin) {
    const result = await getSupabase().from('player_private_details').select('*'); check(result.error);
    result.data?.forEach(row => details.set(row.player_id, row));
  }
  const paths = (data ?? []).map(row => row.photo_path).filter((path): path is string => Boolean(path));
  const urls = new Map<string, string>();
  if (paths.length) {
    const result = await getSupabase().storage.from('player-photos').createSignedUrls(paths, 300); check(result.error);
    result.data?.forEach(item => { if (item.path && item.signedUrl) urls.set(item.path, item.signedUrl); });
  }
  return (data ?? []).map(row => {
    const privateData = details.get(row.id);
    return { id: row.id, name: row.name, number: row.number, position: row.position, active: row.active,
      photo: urls.get(row.photo_path) ?? null, photoPath: row.photo_path, profileId: row.profile_id, version: row.version,
      ...(admin ? { cpf: privateData?.cpf ?? '', email: privateData?.email ?? '', address: privateData?.address ?? '',
        emergencyContactName: privateData?.emergency_contact_name ?? '', emergencyContactPhone: privateData?.emergency_contact_phone ?? '' } : {}) };
  });
}
export async function saveRemotePlayer(input: Player): Promise<string> {
  const player = validatePlayer(input);
  let path = player.photoRemoved ? null : player.photoPath ?? null;
  if (player.photo?.startsWith('data:')) {
    const blob = await (await fetch(player.photo)).blob();
    if (!['image/webp','image/png','image/jpeg'].includes(blob.type) || blob.size > 5 * 1024 * 1024) throw new Error('Foto inválida ou acima de 5 MB.');
    const extension = blob.type === 'image/png' ? 'png' : blob.type === 'image/jpeg' ? 'jpg' : 'webp';
    path = `players/${player.id}/${crypto.randomUUID()}.${extension}`;
    const { error } = await getSupabase().storage.from('player-photos').upload(path, blob, { contentType: blob.type, upsert: false }); check(error);
  }
  const { error } = await getSupabase().rpc('save_player', {
    p_player: { id: player.id, name: player.name, number: player.number, position: player.position, active: player.active, photo_path: path },
    p_details: { cpf: player.cpf, email: player.email, address: player.address, emergency_contact_name: player.emergencyContactName, emergency_contact_phone: player.emergencyContactPhone },
    p_expected_version: player.version ?? null,
  });
  // Em falha de rede, a transação pode ter sido confirmada. Não remover o upload às cegas.
  check(error);
  if (player.photoPath && player.photoPath !== path) {
    const removed = await getSupabase().storage.from('player-photos').remove([player.photoPath]);
    if (removed.error) return 'Jogador salvo. A foto anterior não pôde ser removida do armazenamento.';
  }
  return 'Jogador salvo no banco online.';
}
export async function deleteRemotePlayer(player: Player): Promise<string> {
  const { data: path, error } = await getSupabase().rpc('delete_player', { p_id: player.id, p_expected_version: player.version }); check(error);
  if (path) {
    const removed = await getSupabase().storage.from('player-photos').remove([path]);
    if (removed.error) return 'Cadastro excluído. A limpeza da foto no armazenamento ficou pendente.';
  }
  return 'Jogador excluído do banco online.';
}

export async function invitePlayer(playerId:string):Promise<string>{
 const {data,error}=await getSupabase().functions.invoke('invite-player',{body:{playerId}});
 if(error){let detail='Não foi possível enviar o convite. Confira se a etapa 5 e a função invite-player estão publicadas.';try{const payload=await error.context?.json();if(payload?.error)detail=payload.error;}catch{}throw new Error(detail);}
 if(data?.error)throw new Error(data.error);return data.message;
}
