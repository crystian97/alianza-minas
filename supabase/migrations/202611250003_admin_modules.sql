-- ETAPA 4: gestão de membros, participações e votações transacionais.
begin;
alter table public.weekly_polls add column if not exists version integer not null default 1;
alter table public.weekly_polls add column if not exists updated_at timestamptz not null default now();
create or replace trigger polls_version before update on public.weekly_polls
for each row execute function alianza_private.bump_version();

create or replace function public.admin_members()
returns table(id uuid, display_name text, role text, active boolean, email text)
language plpgsql security definer set search_path = '' as $$
begin
  if not alianza_private.is_admin() then raise exception 'Acesso exclusivo do administrador.' using errcode='42501'; end if;
  return query select p.id,p.display_name,p.role,p.active,u.email::text
    from public.profiles p join auth.users u on u.id=p.id order by p.active, p.display_name;
end;
$$;
create or replace function public.manage_member(p_id uuid,p_name text,p_role text,p_active boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not alianza_private.is_admin() then raise exception 'Acesso exclusivo do administrador.' using errcode='42501'; end if;
  lock table public.profiles in share row exclusive mode;
  if not alianza_private.is_admin() then raise exception 'Acesso revogado.' using errcode='42501'; end if;
  if p_role not in ('admin','staff','player') or p_role is null or p_active is null or length(btrim(p_name)) not between 1 and 120 or p_name is null then
    raise exception 'Nome, perfil e situação inválidos.';
  end if;
  if exists(select 1 from public.profiles where id=p_id and active and role='admin') and
    (not p_active or p_role<>'admin') and (select count(*) from public.profiles where active and role='admin')<=1 then
    raise exception 'Mantenha pelo menos um administrador ativo.';
  end if;
  update public.profiles set display_name=btrim(p_name),role=p_role,active=p_active where id=p_id;
  if not found then raise exception 'Usuário não encontrado.'; end if;
end;
$$;
-- Ninguém consegue contornar a proteção do último administrador pela API de tabelas.
revoke insert,update,delete on public.profiles from authenticated;

create or replace function public.save_participations(p_match_id uuid,p_expected_version integer,p_rows jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare game public.matches; total integer; new_version integer;
begin
  if not alianza_private.is_admin() then raise exception 'Acesso exclusivo do administrador.' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(20261125,4);
  select * into game from public.matches where id=p_match_id for update;
  if not found or game.version is distinct from p_expected_version then raise exception 'Partida alterada. Recarregue antes de salvar.' using errcode='40001'; end if;
  if game.status<>'Finalizado' then raise exception 'Finalize a partida e registre o placar primeiro.'; end if;
  if jsonb_typeof(p_rows) is distinct from 'array' then raise exception 'Lista de participantes inválida.'; end if;
  if exists(select 1 from jsonb_array_elements(p_rows) r where r->>'player_id' is null or r->>'goals' is null or (r->>'goals')::int not between 0 and 999) then
    raise exception 'Informe jogadores e gols válidos.';
  end if;
  select coalesce(sum((r->>'goals')::int),0) into total from jsonb_array_elements(p_rows) r;
  if total>game.goals_for then raise exception 'Os gols dos atletas não podem ultrapassar o placar do Alianza.'; end if;
  -- Atualização verifica histórico protegido e avança a versão na mesma transação.
  update public.matches set updated_at=now() where id=p_match_id returning version into new_version;
  delete from public.match_players where match_id=p_match_id;
  insert into public.match_players(match_id,player_id,goals)
    select p_match_id,(r->>'player_id')::uuid,(r->>'goals')::smallint from jsonb_array_elements(p_rows) r;
  return new_version;
end;
$$;
revoke insert,update,delete on public.match_players from authenticated;

create or replace function public.save_poll(p_poll jsonb,p_matches uuid[],p_candidates uuid[],p_expected_version integer default null)
returns public.weekly_polls language plpgsql security definer set search_path = '' as $$
declare target uuid := (p_poll->>'id')::uuid; saved public.weekly_polls;
begin
  if not alianza_private.is_admin() then raise exception 'Acesso exclusivo do administrador.' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(20261125,4);
  if p_expected_version is null then
    insert into public.weekly_polls(id,week_start,title,opens_at,closes_at)
    values(target,(p_poll->>'week_start')::date,btrim(p_poll->>'title'),(p_poll->>'opens_at')::timestamptz,(p_poll->>'closes_at')::timestamptz);
  else
    update public.weekly_polls set week_start=(p_poll->>'week_start')::date,title=btrim(p_poll->>'title'),
      opens_at=(p_poll->>'opens_at')::timestamptz,closes_at=(p_poll->>'closes_at')::timestamptz
      where id=target and version=p_expected_version and state='draft';
    if not found then raise exception 'Votação alterada, publicada ou removida. Recarregue.' using errcode='40001'; end if;
  end if;
  delete from public.poll_candidates where poll_id=target;
  delete from public.poll_matches where poll_id=target;
  insert into public.poll_matches select target,unnest(p_matches);
  insert into public.poll_candidates select target,unnest(p_candidates);
  if p_poll->>'state'='published' then update public.weekly_polls set state='published' where id=target; end if;
  select * into saved from public.weekly_polls where id=target;
  return saved;
end;
$$;
create or replace function public.delete_poll(p_id uuid,p_expected_version integer)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not alianza_private.is_admin() then raise exception 'Acesso exclusivo do administrador.' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(20261125,4);
  delete from public.weekly_polls where id=p_id and version=p_expected_version and state='draft';
  if not found then raise exception 'Só é possível excluir rascunhos sem alterações concorrentes.' using errcode='40001'; end if;
end;
$$;
revoke insert,update,delete on public.weekly_polls,public.poll_matches,public.poll_candidates from authenticated;
revoke all on function public.admin_members(),public.manage_member(uuid,text,text,boolean),
  public.save_participations(uuid,integer,jsonb),public.save_poll(jsonb,uuid[],uuid[],integer),public.delete_poll(uuid,integer)
from public,anon,authenticated;
grant execute on function public.admin_members(),public.manage_member(uuid,text,text,boolean),
  public.save_participations(uuid,integer,jsonb),public.save_poll(jsonb,uuid[],uuid[],integer),public.delete_poll(uuid,integer)
to authenticated;
notify pgrst,'reload schema';
commit;
select 'ETAPA 4 OK: usuários, participações e votações habilitados.' as resultado;
