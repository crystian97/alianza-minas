import { test, expect, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

// Contratos HTTP simulados: nenhum teste de navegador grava dados no projeto real.
async function backend(page: Page, role = 'admin') {
  const id = '10000000-0000-4000-8000-000000000001';
  const state = { members: [{id:"pending",display_name:"Pessoa pendente",email:"pessoa@example.invalid",role:"player",active:false}] as any[], parts: [] as any[], polls: [] as any[], players: [] as any[], details: [] as any[], opponents: [] as any[], matches: [] as any[], privateReads: 0, uploads: [] as string[], signingUnavailable: false };
  const token = `${Buffer.from('{}').toString('base64url')}.${Buffer.from(JSON.stringify({ sub: id, exp: Math.floor(Date.now()/1000)+3600, role:'authenticated' })).toString('base64url')}.test`;
  const user = { id, email: 'admin@example.invalid', aud:'authenticated', role:'authenticated', app_metadata:{provider:'email'},user_metadata:{},created_at:new Date().toISOString() };
  await page.route('https://*.supabase.co/**',async route=>{
    const request=route.request(), url=new URL(request.url()), path=url.pathname, method=request.method();
    const body=request.postDataJSON?.bind(request); const reply=(data:unknown,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
    if(path==='/auth/v1/token')return reply({access_token:token,refresh_token:'test-refresh',expires_in:3600,token_type:'bearer',user});
    if(path==='/auth/v1/user')return reply(user);
    if(path==='/auth/v1/logout')return reply({});
    if(path==='/rest/v1/profiles')return reply({id,display_name:'Administrador teste',role,active:true});
    if(path==='/rest/v1/players')return reply(state.players);
    if(path==='/rest/v1/player_private_details'){state.privateReads++;return reply(state.details);}
    if(path==='/rest/v1/rpc/save_player'){
      const input=body!();const index=state.players.findIndex(p=>p.id===input.p_player.id);
      const previous=state.players[index];
      if(previous&&previous.version!==input.p_expected_version)return reply({code:'40001',message:'Conflito'},409);
      const row={...input.p_player,version:(previous?.version??0)+1};
      if(index<0)state.players.push(row);else state.players[index]=row;
      state.details=state.details.filter(p=>p.player_id!==row.id);state.details.push({player_id:row.id,...input.p_details});
      return reply(row);
    }
    if(path==='/rest/v1/rpc/delete_player'){const input=body!();const item=state.players.find(p=>p.id===input.p_id);state.players=state.players.filter(p=>p.id!==input.p_id);state.details=state.details.filter(p=>p.player_id!==input.p_id);return reply(item?.photo_path??null);}
    if(path.startsWith('/storage/v1/object/sign/player-photos')&&method==='POST') {
      return reply((body!().paths??[]).map((path:string) => state.signingUnavailable
        ? {path,error:'Preview unavailable'}
        : {path,signedURL:`/object/sign/player-photos/${path}?token=test`}));
    }
    if(path.startsWith('/storage/v1/object/player-photos/')&&method==='POST'){state.uploads.push(path);return reply({Key:path,Id:'test'});}
    if(path==='/storage/v1/object/player-photos'&&method==='DELETE')return reply([]);
    if(path.startsWith('/storage/v1/object/opponent-crests/')&&method==='POST'){state.uploads.push(path);return reply({Key:path,Id:'crest'});}
    if(path==='/storage/v1/object/opponent-crests'&&method==='DELETE')return reply([]);
    if(path.startsWith('/storage/'))return route.fulfill({status:200,contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64')});
    if(['/rest/v1/opponents','/rest/v1/matches'].includes(path)){
      const key=path.endsWith('matches')?'matches':'opponents';let items=state[key];const rowId=url.searchParams.get('id')?.replace('eq.','');
      if(method==='POST'){const row={...body!(),version:1};items.push(row);return reply([row]);}
      if(method==='PATCH'){const row=items.find(p=>p.id===rowId);if(row)Object.assign(row,body!(),{version:row.version+1});return reply(row?[row]:[]);}
      if(method==='DELETE'){state[key]=items.filter(p=>p.id!==rowId);return reply([{id:rowId}]);}
      if(url.searchParams.get('published')==='eq.true')items=items.filter(p=>p.published);
      return reply(key==='matches'?items.map(m=>({...m,opponents:state.opponents.find(o=>o.id===m.opponent_id)})):items);
    }
    if(path==='/rest/v1/rpc/admin_members')return reply(state.members);
    if(path==='/rest/v1/rpc/manage_member'){const p=body!();Object.assign(state.members.find(m=>m.id===p.p_id),{display_name:p.p_name,role:p.p_role,active:p.p_active});return reply(null);}
    if(path==='/rest/v1/match_players')return reply(state.parts);
    if(path==='/rest/v1/rpc/save_participations'){const p=body!();state.parts=p.p_rows.map((r:any)=>({...r,match_id:p.p_match_id}));state.matches.find(m=>m.id===p.p_match_id).version++;return reply(2);}
    if(path==='/rest/v1/rpc/save_poll'){const p=body!();const old=state.polls.find(r=>r.id===p.p_poll.id);const row={...p.p_poll,version:(old?.version??0)+1,poll_matches:p.p_matches.map((match_id:string)=>({match_id})),poll_candidates:p.p_candidates.map((player_id:string)=>({player_id}))};state.polls=state.polls.filter(r=>r.id!==row.id);state.polls.push(row);return reply(row);}
    if(path==='/rest/v1/rpc/delete_poll'){state.polls=state.polls.filter(r=>r.id!==body!().p_id);return reply(null);}
    if(path==='/rest/v1/weekly_polls')return reply(state.polls);
    if(path==='/auth/v1/signup')return reply({user,session:null});
    if(path==='/auth/v1/recover')return reply({});
    return reply({message:`Unexpected mock endpoint ${method} ${path}`},500);
  });
  return state;
}
async function login(page:Page){await page.goto('/entrar');await page.getByLabel('E-mail',{exact:true}).fill('admin@example.invalid');await page.getByLabel('Senha',{exact:true}).fill('test-only-password');await page.getByRole('button',{name:'Entrar',exact:true}).click();await expect(page.getByText('Bem-vindo, Administrador teste.')).toBeVisible();}

test('visitante não abre administração e jogador não recebe dados privados',async({page})=>{
  const state=await backend(page,'player');await page.goto('/admin/jogadores');await expect(page.getByRole('heading',{name:'Entrar no Alianza'})).toBeVisible();expect(state.privateReads).toBe(0);
  await login(page);await page.goto('/admin');await expect(page.getByRole('heading',{name:'Acesso exclusivo da administração'})).toBeVisible();expect(state.privateReads).toBe(0);
});
test('jogador com foto e dados pessoais: criar, recarregar, editar e excluir',async({page})=>{
  const state=await backend(page);await login(page);await page.goto('/admin/jogadores');await page.getByRole('button',{name:'Novo jogador',exact:true}).click();
  await page.getByLabel('Nome completo *').fill('Atleta integração');await page.getByLabel('E-mail',{exact:true}).fill('atleta@example.invalid');
  const png=await page.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=20;canvas.height=20;const context=canvas.getContext('2d')!;context.fillStyle='#800020';context.fillRect(0,0,20,20);return canvas.toDataURL('image/png').split(',')[1];});
  await mkdir('test-results',{recursive:true});await writeFile('test-results/test-photo.png',Buffer.from(png,'base64'));
  await page.getByLabel('Selecionar foto').setInputFiles({name:'foto.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
  await expect(page.getByAltText('Prévia da foto de Atleta integração')).toHaveAttribute('src',/^data:image\//);
  await expect(page.getByRole('button',{name:'Salvar jogador'})).toBeEnabled();await page.getByRole('button',{name:'Salvar jogador'}).click();await expect(page.getByText('Jogador salvo no banco online.')).toBeVisible();
  expect(state.uploads).toHaveLength(1);expect(state.details[0].email).toBe('atleta@example.invalid');const path=state.players[0].photo_path;expect(path).toMatch(/^players\//);
  await page.reload();await page.getByRole('button',{name:'Editar Atleta integração',exact:true}).click();await expect(page.getByLabel('E-mail',{exact:true})).toHaveValue('atleta@example.invalid');await page.getByLabel('Nome completo *').fill('Atleta editado');await page.getByRole('button',{name:'Salvar jogador'}).click();await expect(page.getByRole('heading',{name:'Atleta editado',exact:true})).toBeVisible();expect(state.players[0].photo_path).toBe(path);
  state.signingUnavailable=true;await page.reload();await page.getByRole('button',{name:'Editar Atleta editado',exact:true}).click();await page.getByRole('button',{name:'Salvar jogador'}).click();await expect(page.getByText('Jogador salvo no banco online.')).toBeVisible();expect(state.players[0].photo_path).toBe(path);
  await page.setViewportSize({width:390,height:844});await expect(page.getByRole('navigation',{name:'Administração',exact:true}).getByRole('button',{name:'Jogos',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Agenda pública',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Excluir Atleta editado',exact:true}).click();await page.getByRole('button',{name:'Confirmar exclusão'}).click();await expect(page.getByText('Jogador excluído do banco online.')).toBeVisible();expect(state.players).toHaveLength(0);
});
test('adversário e jogo publicados aparecem na agenda após sair',async({page})=>{
  const state=await backend(page);await login(page);await page.goto('/admin/adversarios');await page.getByRole('button',{name:'Novo adversário'}).click();await page.getByLabel('Nome *',{exact:true}).fill('União teste');await page.getByLabel('Sigla *').fill('UNI');await page.getByRole('button',{name:'Salvar adversário'}).click();await expect(page.getByText('Adversário salvo online.')).toBeVisible();
  await page.goto('/admin');await page.getByRole('button',{name:'Novo jogo',exact:true}).click();await page.getByLabel('Adversário *').selectOption(state.opponents[0].id);await page.getByLabel('Data e horário *').fill('2026-12-05T17:00');await page.getByLabel('Local *').fill('Arena teste');await page.getByLabel('Publicar na agenda').check();await page.getByRole('button',{name:'Salvar partida'}).click();await expect(page.getByText('Partida salva no banco online.')).toBeVisible();
  await page.getByRole('button',{name:'Sair',exact:true}).click();await expect(page.getByRole('button').filter({hasText:'União teste'})).toBeVisible();await expect(page.getByText('17:00',{exact:false}).first()).toBeVisible();await page.goto('/admin');await expect(page.getByRole('heading',{name:'Entrar no Alianza'})).toBeVisible();
});


test('admin libera acesso, registra participantes e publica votação',async({page})=>{
  const state=await backend(page);
  state.players.push({id:'athlete',name:'Atleta da semana',number:9,position:'Atacante',active:true,version:1});
  state.opponents.push({id:'opponent',name:'União',initials:'UNI',color:'#800020',active:true,version:1});
  state.matches.push({id:'game',opponent_id:'opponent',starts_at:'2026-11-25T20:00:00Z',venue:'Arena',competition:'Amistoso',home:true,status:'Finalizado',published:true,goals_for:2,goals_against:0,version:1});
  await login(page);await page.goto('/admin/usuarios');
  await page.getByRole('button',{name:'Editar acesso de Pessoa pendente'}).click();
  await page.getByRole('combobox',{name:'Perfil',exact:true}).selectOption('staff');await page.getByRole('combobox',{name:'Situação',exact:true}).selectOption('active');
  await page.getByRole('button',{name:'Salvar acesso'}).click();await expect(page.getByText('Acesso atualizado.')).toBeVisible();expect(state.members[0].active).toBe(true);expect(state.members[0].role).toBe('staff');
  await page.goto('/admin/participacoes');await page.getByLabel('Partida finalizada').selectOption('game');await page.getByLabel('Atleta da semana',{exact:true}).check();await page.getByLabel('Gols de Atleta da semana').fill('2');await page.getByRole('button',{name:'Salvar participações'}).click();await expect(page.getByText('Participações salvas.',{exact:false})).toBeVisible();expect(state.parts[0].goals).toBe(2);
  await page.goto('/admin/votacoes');await page.getByRole('button',{name:'Nova votação'}).click();await page.getByLabel('Semana (segunda-feira) *').fill('2026-11-23');await page.getByLabel('2026-11-25 · União',{exact:true}).check();await page.getByLabel('Atleta da semana',{exact:true}).check();await page.getByRole('button',{name:'Salvar rascunho'}).click();await expect(page.getByText('Rascunho da votação salvo.')).toBeVisible();expect(state.polls[0].state).toBe('draft');
  await page.reload();await page.getByRole('button',{name:'Editar votação'}).click();page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Publicar votação'}).click();await expect(page.getByText('Votação publicada para o time.')).toBeVisible();expect(state.polls[0].state).toBe('published');await expect(page.getByRole('button',{name:'Editar votação'})).toHaveCount(0);
});

test('solicitação de acesso e recuperação têm confirmação sem liberar área interna',async({page})=>{
  await backend(page);await page.goto('/cadastro');await page.getByLabel('Nome completo *').fill('Pessoa teste');await page.getByLabel('E-mail *',{exact:true}).fill('pessoa@example.invalid');await page.getByLabel('Senha *',{exact:true}).fill('test-password');await page.getByLabel('Confirmar senha *').fill('test-password');await page.getByRole('button',{name:'Solicitar acesso',exact:true}).click();await expect(page.getByRole('status')).toContainText('administrador também precisa ativar');
  await page.goto('/admin');await expect(page.getByRole('heading',{name:'Entrar no Alianza'})).toBeVisible();await page.getByRole('button',{name:'Esqueci minha senha'}).click();await page.getByLabel('E-mail',{exact:true}).fill('pessoa@example.invalid');await page.getByRole('button',{name:'Enviar recuperação'}).click();await expect(page.getByRole('status')).toContainText('Se o endereço possuir uma conta');
});

test('escudo do adversário: upload, persistência e remoção com sigla',async({page})=>{
 const state=await backend(page);await login(page);await page.goto('/admin/adversarios');await page.getByRole('button',{name:'Novo adversário'}).click();await page.getByLabel('Nome *',{exact:true}).fill('Time escudo');await page.getByLabel('Sigla *').fill('TES');
 const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=30;const ctx=c.getContext('2d')!;ctx.fillStyle='#990033';ctx.fillRect(0,0,30,30);return c.toDataURL().split(',')[1];});
 await page.getByLabel('Selecionar escudo').setInputFiles({name:'escudo.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});await expect(page.getByAltText('Escudo do adversário')).toHaveAttribute('src',/^data:/);await page.getByRole('button',{name:'Salvar adversário'}).click();await expect(page.getByText('Adversário salvo online.')).toBeVisible();expect(state.uploads).toHaveLength(1);expect(state.opponents[0].crest_path).toMatch(/^opponents\//);
 await page.reload();await expect(page.getByAltText('Escudo do adversário')).toHaveAttribute('src',/opponent-crests/);await page.getByRole('button',{name:'Editar',exact:true}).click();await page.getByLabel('Cidade',{exact:true}).fill('Belo Horizonte');const path=state.opponents[0].crest_path;await page.getByRole('button',{name:'Salvar adversário'}).click();await expect(page.getByText('Adversário salvo online.')).toBeVisible();expect(state.opponents[0].crest_path).toBe(path);
 await page.getByRole('button',{name:'Editar',exact:true}).click();await page.getByRole('button',{name:'Remover escudo'}).click();await page.getByRole('button',{name:'Salvar adversário'}).click();await expect(page.getByText('Adversário salvo online.')).toBeVisible();expect(state.opponents[0].crest_path).toBeNull();await expect(page.locator('.opponent-initials')).toHaveText('TES');
});

test('inicial mobile mostra próximo confronto e totais reais',async({page})=>{
 const state=await backend(page);state.opponents.push({id:'other',name:'União FC',initials:'UFC',color:'#004499'});state.matches.push({id:'past',opponent_id:'other',starts_at:'2026-01-01T20:00:00Z',venue:'Arena',competition:'Amistoso',home:true,status:'Finalizado',published:true,goals_for:3,goals_against:1,version:1},{id:'next',opponent_id:'other',starts_at:'2099-12-01T20:00:00Z',venue:'Arena Barbosa',competition:'Campeonato',home:true,status:'Agendado',published:true,version:1});await page.setViewportSize({width:390,height:844});await login(page);await expect(page.locator('.next-game')).toContainText('União FC');await expect(page.locator('.home-stats article').nth(1)).toContainText('3');await expect(page.locator('.home-stats article').nth(3)).toContainText('1');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'test-results/home-mobile.png',fullPage:true});
});
