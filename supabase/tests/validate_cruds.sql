-- ETAPA 2: execute por inteiro no SQL Editor, depois da etapa 1.
-- Tudo roda numa transação revertida ao final. Não cria contas utilizáveis.
-- Simula papéis reais com SET LOCAL ROLE; não testa somente como postgres.
begin;
do $test$
declare
  admin_id uuid := gen_random_uuid(); member_id uuid := gen_random_uuid();
  staff_id uuid := gen_random_uuid(); inactive_id uuid := gen_random_uuid();
  player_a uuid := gen_random_uuid(); player_b uuid := gen_random_uuid(); disposable uuid := gen_random_uuid();
  opponent uuid := gen_random_uuid(); hidden_opponent uuid := gen_random_uuid();
  game uuid := gen_random_uuid(); draft_game uuid := gen_random_uuid();
  poll uuid := gen_random_uuid(); empty_poll uuid := gen_random_uuid(); empty_game uuid := gen_random_uuid();
  week date := date_trunc('week', now() at time zone 'America/Sao_Paulo')::date - 7;
  amount bigint; changed bigint; denied boolean; result record;
begin
  select count(*) into amount from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relrowsecurity and c.relname in
      ('profiles', 'players', 'player_private_details', 'opponents', 'matches', 'match_players',
       'weekly_polls', 'poll_matches', 'poll_candidates', 'votes');
  if amount <> 10 then raise exception 'FALHOU: são necessárias 10 tabelas com RLS.'; end if;
  -- Fixtures de Auth sem senha, token ou identidade de login; revertidas ao final.
  insert into auth.users(id, email, raw_user_meta_data) values
    (admin_id, admin_id::text || '@example.invalid', '{"full_name":"Admin teste","role":"admin"}'),
    (member_id, member_id::text || '@example.invalid', '{}'),
    (staff_id, staff_id::text || '@example.invalid', '{}'),
    (inactive_id, inactive_id::text || '@example.invalid', '{}');
  if not exists(select 1 from public.profiles where id = admin_id and role = 'player' and not active) then
    raise exception 'FALHOU: metadados não podem ativar/promover usuário.';
  end if;
  update public.profiles set role = 'admin', active = true where id = admin_id;
  update public.profiles set active = true where id = member_id;
  update public.profiles set role = 'staff', active = true where id = staff_id;

  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  if not alianza_private.is_admin() then raise exception 'FALHOU: perfil admin.'; end if;

  -- Jogadores: criar, consultar, editar, excluir; dados privados e cascata.
  insert into public.players(id, profile_id, name, number, position) values
    (player_a, member_id, 'Atleta A teste SQL', 9, 'Atacante'),
    (player_b, null, 'Atleta B teste SQL', 1, 'Goleiro'),
    (disposable, null, 'Descartável teste SQL', 5, 'Defensor');
  insert into public.player_private_details(player_id, cpf, email, address, emergency_contact_name, emergency_contact_phone)
    values (disposable, '52998224725', 'teste@example.invalid', 'Endereço fictício', 'Contato fictício', '(31) 99999-9999');
  update public.players set name = 'Editado teste SQL' where id = disposable;
  if not exists (select 1 from public.players where id = disposable and name = 'Editado teste SQL' and version = 2) then
    raise exception 'FALHOU: edição/versão de jogador.';
  end if;
  update public.player_private_details set address = 'Endereço fictício editado' where player_id = disposable;
  if not exists(select 1 from public.player_private_details where player_id = disposable and address = 'Endereço fictício editado') then
    raise exception 'FALHOU: edição dos dados privados.';
  end if;
  denied := false;
  begin update public.player_private_details set cpf = '11111111111' where player_id = disposable;
  exception when check_violation then denied := true; end;
  if not denied then raise exception 'FALHOU: CPF inválido aceito.'; end if;
  denied := false;
  begin update public.player_private_details set emergency_contact_phone = '' where player_id = disposable;
  exception when check_violation then denied := true; end;
  if not denied then raise exception 'FALHOU: contato incompleto aceito.'; end if;
  denied := false;
  begin update public.player_private_details set email = 'invalido' where player_id = disposable;
  exception when check_violation then denied := true; end;
  if not denied then raise exception 'FALHOU: email inválido aceito.'; end if;
  delete from public.players where id = disposable;
  if exists(select 1 from public.player_private_details where player_id = disposable) then raise exception 'FALHOU: cascata de dados privados.'; end if;
  insert into public.player_private_details(player_id, email) values (player_a, 'privado@example.invalid');

  -- Adversários e partidas: CRUD, publicação e integridade dos vínculos.
  insert into public.opponents(id, name, initials) values
    (opponent, 'Adversário teste SQL', 'TST'), (hidden_opponent, 'Adversário oculto SQL', 'HID'),
    (disposable, 'Adversário descartável', 'TMP');
  update public.opponents set city = 'Cidade fictícia' where id = opponent;
  if not exists(select 1 from public.opponents where id = opponent and city = 'Cidade fictícia' and version = 2) then raise exception 'FALHOU: edição adversário.'; end if;
  delete from public.opponents where id = disposable;
  if exists(select 1 from public.opponents where id = disposable) then raise exception 'FALHOU: exclusão adversário.'; end if;
  insert into public.matches(id, opponent_id, starts_at, venue) values
    (game, opponent, (week + 5)::timestamp at time zone 'America/Sao_Paulo', 'Arena teste SQL'),
    (draft_game, hidden_opponent, now() + interval '7 days', 'Arena rascunho'),
    (disposable, opponent, now() + interval '14 days', 'Arena descartável');
  update public.matches set published = true, status = 'Finalizado', goals_for = 2, goals_against = 1 where id = game;
  if not exists(select 1 from public.matches where id = game and published and goals_for = 2 and version = 2) then raise exception 'FALHOU: atualização partida.'; end if;
  denied := false;
  begin delete from public.opponents where id = opponent;
  exception when foreign_key_violation or restrict_violation then denied := true; end;
  if not denied then raise exception 'FALHOU: excluiu adversário com jogo.'; end if;
  delete from public.matches where id = disposable;
  if exists(select 1 from public.matches where id = disposable) then raise exception 'FALHOU: exclusão partida.'; end if;
  denied := false;
  begin update public.matches set status = 'Adiado' where id = draft_game;
  exception when check_violation then denied := true; end;
  if not denied then raise exception 'FALHOU: adiamento sem aviso.'; end if;
  insert into public.match_players(match_id, player_id, goals) values (game, player_a, 2), (game, player_b, 0);
  update public.match_players set goals = 1 where match_id = game and player_id = player_a;
  if not exists(select 1 from public.match_players where match_id = game and player_id = player_a and goals = 1) then raise exception 'FALHOU: edição participação.'; end if;
  delete from public.match_players where match_id = game and player_id = player_b;
  if exists(select 1 from public.match_players where match_id = game and player_id = player_b) then raise exception 'FALHOU: exclusão participação.'; end if;
  insert into public.match_players(match_id, player_id) values(game, player_b);
  denied := false;
  begin delete from public.players where id = player_a;
  exception when foreign_key_violation or restrict_violation then denied := true; end;
  if not denied then raise exception 'FALHOU: excluiu jogador com histórico.'; end if;

  -- Rascunho pode ser editado e excluído com seus vínculos.
  insert into public.weekly_polls(id, week_start, title, opens_at, closes_at)
    values (disposable, week - 14, 'Rascunho teste', now(), now() + interval '1 day');
  update public.weekly_polls set title = 'Rascunho editado' where id = disposable;
  if not exists(select 1 from public.weekly_polls where id = disposable and title = 'Rascunho editado') then raise exception 'FALHOU: editar rascunho votação.'; end if;
  insert into public.poll_candidates values(disposable, player_b);
  insert into public.poll_matches values(disposable, game);
  delete from public.weekly_polls where id = disposable;
  if exists(select 1 from public.poll_candidates where poll_id = disposable) or exists(select 1 from public.poll_matches where poll_id = disposable) then
    raise exception 'FALHOU: exclusão de rascunho e vínculos.';
  end if;
  insert into public.weekly_polls(id, week_start, title, opens_at, closes_at)
    values (poll, week, 'Craque teste SQL', now() - interval '1 hour', now() + interval '1 hour');
  denied := false;
  begin update public.weekly_polls set state = 'published' where id = poll;
  exception when raise_exception then denied := true; end;
  if not denied then raise exception 'FALHOU: publicação sem candidatos.'; end if;
  insert into public.poll_matches values(poll, game);
  insert into public.poll_candidates values(poll, player_a), (poll, player_b);
  insert into public.players(id, name, number, position) values(disposable, 'Não participou', 8, 'Meio-campo');
  insert into public.poll_candidates values(poll, disposable);
  denied := false;
  begin update public.weekly_polls set state = 'published' where id = poll;
  exception when raise_exception then denied := true; end;
  if not denied then raise exception 'FALHOU: publicou candidato sem participação.'; end if;
  delete from public.poll_candidates where poll_id = poll and player_id = disposable;
  delete from public.players where id = disposable;
  update public.weekly_polls set state = 'published' where id = poll;
  denied := false;
  begin update public.weekly_polls set closes_at = now() + interval '3 days' where id = poll;
  exception when raise_exception then denied := true; end;
  if not denied then raise exception 'FALHOU: alterou votação publicada.'; end if;
  denied := false;
  begin delete from public.poll_candidates where poll_id = poll and player_id = player_b;
  exception when raise_exception then denied := true; end;
  if not denied then raise exception 'FALHOU: excluiu candidato publicado.'; end if;
  denied := false;
  begin delete from public.match_players where match_id = game and player_id = player_b;
  exception when raise_exception then denied := true; end;
  if not denied then raise exception 'FALHOU: alterou participação histórica.'; end if;

  -- Visitante: só jogo publicado e seu adversário. Sem elenco ou votação.
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';
  if not exists(select 1 from public.matches where id = game) then raise exception 'FALHOU: agenda pública.'; end if;
  if exists(select 1 from public.matches where id = draft_game) then raise exception 'FALHOU: rascunho público.'; end if;
  if not exists(select 1 from public.opponents where id = opponent) or exists(select 1 from public.opponents where id = hidden_opponent) then
    raise exception 'FALHOU: visibilidade de adversários.';
  end if;
  denied := false;
  begin perform * from public.players;
  exception when insufficient_privilege then denied := true; end;
  if not denied then raise exception 'FALHOU: visitante acessou elenco.'; end if;
  denied := false;
  begin perform * from public.player_private_details;
  exception when insufficient_privilege then denied := true; end;
  if not denied then raise exception 'FALHOU: visitante acessou dados privados.'; end if;
  denied := false;
  begin perform * from public.poll_results(poll);
  exception when insufficient_privilege then denied := true; end;
  if not denied then raise exception 'FALHOU: visitante acessou votação.'; end if;

  -- Membro: consulta elenco, sem dados pessoais, escrita ou autopromoção.
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', member_id::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', member_id, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  if not exists(select 1 from public.players where id = player_a) then raise exception 'FALHOU: membro sem elenco.'; end if;
  if exists(select 1 from public.player_private_details where player_id = player_a) then raise exception 'FALHOU: membro viu dados pessoais.'; end if;
  update public.profiles set role = 'admin', active = true where id = member_id;
  get diagnostics changed = row_count;
  if changed <> 0 or alianza_private.is_admin() then raise exception 'FALHOU: autopromoção.'; end if;
  update public.players set name = 'Tentativa indevida' where id = player_a;
  get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'FALHOU: membro editou elenco.'; end if;
  denied := false;
  begin insert into public.opponents(name, initials) values('Indevido', 'BAD');
  exception when insufficient_privilege then denied := true; end;
  if not denied then raise exception 'FALHOU: membro criou adversário.'; end if;
  denied := false;
  begin perform public.cast_vote(poll, disposable);
  exception when raise_exception then denied := true; end;
  if not denied then raise exception 'FALHOU: candidato inválido.'; end if;
  perform public.cast_vote(poll, player_a); -- voto em si próprio é permitido
  if not public.has_voted(poll) then raise exception 'FALHOU: registro de participação.'; end if;
  denied := false;
  begin perform public.cast_vote(poll, player_b);
  exception when raise_exception then denied := true; end;
  if not denied then raise exception 'FALHOU: segundo voto.'; end if;
  denied := false;
  begin perform * from public.votes;
  exception when insufficient_privilege then denied := true; end;
  if not denied then raise exception 'FALHOU: exposição de votos individuais.'; end if;
  denied := false;
  begin update public.votes set player_id = player_b where poll_id = poll;
  exception when insufficient_privilege then denied := true; end;
  if not denied then raise exception 'FALHOU: troca de voto.'; end if;
  denied := false;
  begin delete from public.votes where poll_id = poll;
  exception when insufficient_privilege then denied := true; end;
  if not denied then raise exception 'FALHOU: exclusão de voto.'; end if;
  select * into result from public.poll_results(poll) where player_id = player_a;
  if result.votes <> 1 or result.percentage <> 100 or result.winner then raise exception 'FALHOU: parcial de votos.'; end if;

  -- Comissão vota; administrador não recebe acesso aos votos individuais.
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', staff_id::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', staff_id, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  perform public.cast_vote(poll, player_b);
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  denied := false;
  begin perform * from public.votes;
  exception when insufficient_privilege then denied := true; end;
  if not denied then raise exception 'FALHOU: admin leu votos individuais pela API.'; end if;

  -- Prepara votação sem votos para validar encerramento sem vencedor.
  insert into public.matches(id, opponent_id, starts_at, venue, status, goals_for, goals_against)
    values(empty_game, opponent, (week - 2)::timestamp at time zone 'America/Sao_Paulo', 'Arena teste', 'Finalizado', 0, 0);
  insert into public.match_players(match_id, player_id) values(empty_game, player_a);
  insert into public.weekly_polls(id, week_start, title, opens_at, closes_at)
    values(empty_poll, week - 7, 'Sem votos', now() - interval '2 hours', now() + interval '1 hour');
  insert into public.poll_matches values(empty_poll, empty_game);
  insert into public.poll_candidates values(empty_poll, player_a);
  update public.weekly_polls set state = 'published' where id = empty_poll;

  -- Só no teste como postgres: simula a passagem do prazo, sem esperar uma hora.
  -- Essa alteração e a desativação temporária do gatilho são revertidas no ROLLBACK.
  execute 'reset role';
  denied := false;
  begin update public.votes set player_id = player_b where poll_id = poll and voter_id = member_id;
  exception when raise_exception then denied := true; end;
  if not denied then raise exception 'FALHOU: gatilho de imutabilidade do voto.'; end if;
  alter table public.weekly_polls disable trigger guard_poll;
  update public.weekly_polls set closes_at = now() - interval '1 minute' where id in (poll, empty_poll);
  alter table public.weekly_polls enable trigger guard_poll;
  perform set_config('request.jwt.claim.sub', member_id::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', member_id, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into amount from public.poll_results(poll) where winner and votes = 1 and percentage = 50;
  if amount <> 2 then raise exception 'FALHOU: empate precisa reconhecer os dois vencedores.'; end if;
  if exists(select 1 from public.poll_results(empty_poll) where winner or votes <> 0) then raise exception 'FALHOU: votação vazia gerou vencedor.'; end if;
  denied := false;
  begin perform public.cast_vote(poll, player_a);
  exception when raise_exception then denied := true; end;
  if not denied then raise exception 'FALHOU: voto fora do prazo.'; end if;

  -- Cadastro não aprovado / acesso revogado.
  execute 'reset role';
  update public.profiles set active = false where id = member_id;
  execute 'set local role authenticated';
  if exists(select 1 from public.players where id = player_a) then raise exception 'FALHOU: acesso revogado manteve elenco.'; end if;
  denied := false;
  begin perform public.cast_vote(poll, player_a);
  exception when insufficient_privilege then denied := true; end;
  if not denied then raise exception 'FALHOU: usuário revogado votou.'; end if;
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', inactive_id::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', inactive_id, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  if exists(select 1 from public.players where id = player_a) then raise exception 'FALHOU: não aprovado acessou elenco.'; end if;
  execute 'reset role';

  -- Confere configuração dos buckets, sem inserir objetos de Storage via SQL.
  if not exists(select 1 from storage.buckets where id = 'player-photos' and not public and file_size_limit = 5242880) then
    raise exception 'FALHOU: bucket de fotos.';
  end if;
  if not exists(select 1 from storage.buckets where id = 'opponent-crests' and public) then raise exception 'FALHOU: bucket de escudos.'; end if;
end;
$test$;
rollback;
select 'ETAPA 2 OK: CRUDs, permissões, voto único, prazo e empate validados. Dados de teste revertidos.' as resultado;
