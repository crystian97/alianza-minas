-- ETAPA 1: executar uma vez, por inteiro, no SQL Editor do projeto Alianza.
-- Transacional: um erro desfaz esta execução. Não apaga tabelas existentes.
begin;

create schema alianza_private;
revoke all on schema alianza_private from public;
grant usage on schema alianza_private to anon, authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  display_name text not null check (length(btrim(display_name)) between 1 and 120),
  role text not null default 'player' check (role in ('admin', 'staff', 'player')),
  active boolean not null default false,
  created_at timestamptz not null default now()
);

create function alianza_private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and active and role = 'admin');
$$;
create function alianza_private.is_member() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and active);
$$;
create function alianza_private.is_voter() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and active and role in ('player', 'staff'));
$$;

-- Cadastro no Auth não concede acesso ao time nem aceita papel vindo de metadados.
create function alianza_private.on_signup() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, display_name) values
    (new.id, left(coalesce(nullif(btrim(new.raw_user_meta_data->>'full_name'), ''), 'Novo membro'), 120));
  return new;
end;
$$;
create trigger alianza_profile_created after insert on auth.users
for each row execute function alianza_private.on_signup();
insert into public.profiles(id, display_name)
select id, left(coalesce(nullif(btrim(raw_user_meta_data->>'full_name'), ''), 'Novo membro'), 120) from auth.users;

create function alianza_private.valid_cpf(value text) returns boolean
language plpgsql immutable set search_path = '' as $$
declare n int; i int; total int; digit int;
begin
  if value = '' then return true; end if;
  if value !~ '^[0-9]{11}$' or value = repeat(substr(value, 1, 1), 11) then return false; end if;
  for n in 9..10 loop
    total := 0;
    for i in 1..n loop total := total + substr(value, i, 1)::int * (n + 2 - i); end loop;
    digit := (total * 10 % 11) % 10;
    if digit <> substr(value, n + 1, 1)::int then return false; end if;
  end loop;
  return true;
end;
$$;

create table public.players (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references public.profiles(id) on delete restrict,
  name text not null check (length(btrim(name)) between 1 and 120),
  number smallint not null check (number between 1 and 99),
  position text not null check (position in ('Goleiro', 'Defensor', 'Meio-campo', 'Atacante')),
  active boolean not null default true,
  photo_path text check (photo_path is null or photo_path ~ ('^players/' || id::text || '/[a-zA-Z0-9_-]+\.(webp|jpg|jpeg|png)$')),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Camisa não é única: reservas e cadastros históricos podem compartilhar número.
create table public.player_private_details (
  player_id uuid primary key references public.players(id) on delete cascade,
  cpf text not null default '' check (alianza_private.valid_cpf(cpf)),
  email text not null default '' check (email = '' or (length(email) <= 254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')),
  address text not null default '' check (length(address) <= 500),
  emergency_contact_name text not null default '' check (length(emergency_contact_name) <= 120),
  emergency_contact_phone text not null default '',
  check ((btrim(emergency_contact_name) = '') = (btrim(emergency_contact_phone) = '')),
  check (emergency_contact_phone = '' or
    (emergency_contact_phone ~ '^\+?[0-9 ().-]+$' and length(regexp_replace(emergency_contact_phone, '[^0-9]', '', 'g')) between 10 and 15))
);
create unique index player_cpf_unique on public.player_private_details(cpf) where cpf <> '';

create table public.opponents (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 120),
  initials text not null check (length(btrim(initials)) between 1 and 4),
  color text not null default '#a63b59' check (color ~ '^#[a-fA-F0-9]{6}$'),
  city text not null default '' check (length(city) <= 120),
  crest_path text check (crest_path is null or crest_path ~ ('^opponents/' || id::text || '/[a-zA-Z0-9_-]+\.(webp|jpg|jpeg|png)$')),
  active boolean not null default true,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  opponent_id uuid not null references public.opponents(id) on delete restrict,
  starts_at timestamptz not null,
  venue text not null check (length(btrim(venue)) between 1 and 120),
  competition text not null default 'Amistoso' check (length(btrim(competition)) between 1 and 80),
  home boolean not null default true,
  status text not null default 'Agendado' check (status in ('Agendado', 'Adiado', 'Cancelado', 'Finalizado')),
  published boolean not null default false,
  note text not null default '' check (length(note) <= 500),
  goals_for smallint check (goals_for >= 0),
  goals_against smallint check (goals_against >= 0),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status not in ('Adiado', 'Cancelado') or length(btrim(note)) > 0),
  check ((status = 'Finalizado' and goals_for is not null and goals_against is not null)
      or (status <> 'Finalizado' and goals_for is null and goals_against is null))
);
create index matches_date_idx on public.matches(starts_at);
create index matches_opponent_idx on public.matches(opponent_id);
create table public.match_players (
  match_id uuid not null references public.matches(id) on delete restrict,
  player_id uuid not null references public.players(id) on delete restrict,
  goals smallint not null default 0 check (goals >= 0),
  primary key (match_id, player_id)
);
create index match_players_player_idx on public.match_players(player_id);

create table public.weekly_polls (
  id uuid primary key default gen_random_uuid(),
  week_start date not null unique check (extract(isodow from week_start) = 1),
  title text not null check (length(btrim(title)) between 1 and 120),
  opens_at timestamptz not null,
  closes_at timestamptz not null,
  state text not null default 'draft' check (state in ('draft', 'published')),
  created_at timestamptz not null default now(),
  check (closes_at > opens_at)
);
create table public.poll_matches (
  poll_id uuid not null references public.weekly_polls(id) on delete cascade,
  match_id uuid not null references public.matches(id) on delete restrict,
  primary key (poll_id, match_id)
);
create index poll_matches_match_idx on public.poll_matches(match_id);
create table public.poll_candidates (
  poll_id uuid not null references public.weekly_polls(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete restrict,
  primary key (poll_id, player_id)
);
create index poll_candidates_player_idx on public.poll_candidates(player_id);
create table public.votes (
  poll_id uuid not null,
  voter_id uuid not null references public.profiles(id) on delete restrict,
  player_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (poll_id, voter_id),
  foreign key (poll_id, player_id) references public.poll_candidates(poll_id, player_id) on delete restrict
);
create index votes_candidate_idx on public.votes(poll_id, player_id);
create index votes_voter_idx on public.votes(voter_id);

create function alianza_private.bump_version() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.version := old.version + 1;
  new.updated_at := now();
  return new;
end;
$$;
create trigger players_version before update on public.players for each row execute function alianza_private.bump_version();
create trigger opponents_version before update on public.opponents for each row execute function alianza_private.bump_version();
create trigger matches_version before update on public.matches for each row execute function alianza_private.bump_version();

-- A publicação fixa candidatos, partidas e prazo. Corrigir antes de publicar.
create function alianza_private.guard_poll() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op <> 'INSERT' and old.state = 'published' then
    raise exception 'Votação publicada não pode ser alterada ou excluída.';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  if new.state = 'published' then
    if tg_op = 'INSERT' then raise exception 'Crie a votação como rascunho antes de publicar.'; end if;
    if new.closes_at <= now() then raise exception 'O encerramento precisa estar no futuro.'; end if;
    if not exists (select 1 from public.poll_candidates where poll_id = new.id) then
      raise exception 'Selecione pelo menos um candidato.';
    end if;
    if not exists (select 1 from public.poll_matches where poll_id = new.id) then
      raise exception 'Vincule as partidas da semana.';
    end if;
    if exists (
      select 1 from public.poll_matches pm join public.matches m on m.id = pm.match_id
      where pm.poll_id = new.id and (m.status <> 'Finalizado' or
        (m.starts_at at time zone 'America/Sao_Paulo')::date < new.week_start or
        (m.starts_at at time zone 'America/Sao_Paulo')::date >= new.week_start + 7)
    ) then raise exception 'As partidas precisam estar finalizadas e pertencer à semana escolhida.'; end if;
    if exists (
      select 1 from public.poll_candidates c where c.poll_id = new.id and not exists (
        select 1 from public.poll_matches pm join public.match_players mp on mp.match_id = pm.match_id
        where pm.poll_id = new.id and mp.player_id = c.player_id
      )
    ) then raise exception 'Candidato precisa ter participado de uma partida vinculada.'; end if;
  end if;
  return new;
end;
$$;
create trigger guard_poll before insert or update or delete on public.weekly_polls for each row execute function alianza_private.guard_poll();

create function alianza_private.guard_poll_children() returns trigger
language plpgsql set search_path = '' as $$
declare poll_state text; target uuid;
begin
  if tg_op = 'UPDATE' and new.poll_id <> old.poll_id then raise exception 'Não mova vínculos entre votações.'; end if;
  target := case when tg_op = 'DELETE' then old.poll_id else new.poll_id end;
  select state into poll_state from public.weekly_polls where id = target for update;
  if poll_state = 'published' then raise exception 'Candidatos e partidas de votação publicada são imutáveis.'; end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
create trigger guard_candidates before insert or update or delete on public.poll_candidates for each row execute function alianza_private.guard_poll_children();
create trigger guard_poll_matches before insert or update or delete on public.poll_matches for each row execute function alianza_private.guard_poll_children();

create function alianza_private.guard_match_history() returns trigger
language plpgsql security definer set search_path = '' as $$
declare target uuid;
begin
  if tg_table_name = 'matches' then target := old.id;
  else
    target := case when tg_op = 'INSERT' then new.match_id else old.match_id end;
    if tg_op = 'UPDATE' and new.match_id <> old.match_id then raise exception 'Não mova participações entre partidas.'; end if;
  end if;
  -- O mesmo bloqueio é usado pela publicação para evitar disputas entre requisições.
  perform 1 from public.weekly_polls p join public.poll_matches pm on pm.poll_id = p.id
    where pm.match_id = target for update of p;
  if exists (select 1 from public.poll_matches pm join public.weekly_polls p on p.id = pm.poll_id
    where pm.match_id = target and p.state = 'published') then
    raise exception 'Partida e participações vinculadas a votação publicada têm histórico protegido.';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
create trigger match_history before update or delete on public.matches for each row execute function alianza_private.guard_match_history();
create trigger participation_history before insert or update or delete on public.match_players for each row execute function alianza_private.guard_match_history();

create function alianza_private.immutable_vote() returns trigger
language plpgsql set search_path = '' as $$
begin raise exception 'O voto é definitivo e não pode ser alterado ou excluído.'; end;
$$;
create trigger immutable_vote before update or delete on public.votes for each row execute function alianza_private.immutable_vote();

-- Nenhuma função interna recebe EXECUTE público por acidente.
revoke all on all functions in schema alianza_private from public, anon, authenticated;
grant execute on function alianza_private.is_admin(), alianza_private.is_member(), alianza_private.is_voter(), alianza_private.valid_cpf(text) to authenticated;
grant execute on function alianza_private.is_admin(), alianza_private.is_member() to anon;

-- RLS + grants explícitos: não depende da opção automática do painel.
alter table public.profiles enable row level security;
alter table public.players enable row level security;
alter table public.player_private_details enable row level security;
alter table public.opponents enable row level security;
alter table public.matches enable row level security;
alter table public.match_players enable row level security;
alter table public.weekly_polls enable row level security;
alter table public.poll_matches enable row level security;
alter table public.poll_candidates enable row level security;
alter table public.votes enable row level security;
revoke all on public.profiles, public.players, public.player_private_details, public.opponents,
  public.matches, public.match_players, public.weekly_polls, public.poll_matches, public.poll_candidates, public.votes
  from public, anon, authenticated;
grant usage on schema public to anon, authenticated;
grant select on public.matches, public.opponents to anon;
grant select, insert, update, delete on public.profiles, public.players, public.player_private_details,
  public.opponents, public.matches, public.match_players, public.weekly_polls, public.poll_matches, public.poll_candidates to authenticated;

create policy profiles_self on public.profiles for select to authenticated using (id = auth.uid());
create policy profiles_admin on public.profiles for all to authenticated using (alianza_private.is_admin()) with check (alianza_private.is_admin());
create policy players_read on public.players for select to authenticated using (alianza_private.is_member());
create policy players_admin on public.players for all to authenticated using (alianza_private.is_admin()) with check (alianza_private.is_admin());
create policy details_admin on public.player_private_details for all to authenticated using (alianza_private.is_admin()) with check (alianza_private.is_admin());
create policy matches_read on public.matches for select to anon, authenticated using (published or alianza_private.is_member());
create policy matches_admin on public.matches for all to authenticated using (alianza_private.is_admin()) with check (alianza_private.is_admin());
create policy opponents_read on public.opponents for select to anon, authenticated using (
  alianza_private.is_member() or exists (select 1 from public.matches where opponent_id = opponents.id and published)
);
create policy opponents_admin on public.opponents for all to authenticated using (alianza_private.is_admin()) with check (alianza_private.is_admin());
create policy participation_read on public.match_players for select to authenticated using (alianza_private.is_member());
create policy participation_admin on public.match_players for all to authenticated using (alianza_private.is_admin()) with check (alianza_private.is_admin());
create policy polls_read on public.weekly_polls for select to authenticated using (state = 'published' and alianza_private.is_member());
create policy polls_admin on public.weekly_polls for all to authenticated using (alianza_private.is_admin()) with check (alianza_private.is_admin());
create policy candidates_read on public.poll_candidates for select to authenticated using (
  alianza_private.is_member() and exists (select 1 from public.weekly_polls where id = poll_id and state = 'published')
);
create policy candidates_admin on public.poll_candidates for all to authenticated using (alianza_private.is_admin()) with check (alianza_private.is_admin());
create policy poll_matches_read on public.poll_matches for select to authenticated using (
  alianza_private.is_member() and exists (select 1 from public.weekly_polls where id = poll_id and state = 'published')
);
create policy poll_matches_admin on public.poll_matches for all to authenticated using (alianza_private.is_admin()) with check (alianza_private.is_admin());
-- votes propositalmente sem grants/policies para leitura direta, inclusive pelo admin da aplicação.

create function public.cast_vote(p_poll_id uuid, p_player_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare poll public.weekly_polls;
begin
  if not alianza_private.is_voter() then raise exception 'Apenas jogadores e comissão ativos podem votar.' using errcode = '42501'; end if;
  select * into poll from public.weekly_polls where id = p_poll_id for share;
  if not found or poll.state <> 'published' or now() < poll.opens_at or now() >= poll.closes_at then
    raise exception 'Votação fora do período de participação.';
  end if;
  if not exists (select 1 from public.poll_candidates where poll_id = p_poll_id and player_id = p_player_id) then
    raise exception 'Candidato não pertence a esta votação.';
  end if;
  insert into public.votes(poll_id, voter_id, player_id) values (p_poll_id, auth.uid(), p_player_id);
exception when unique_violation then raise exception 'Você já votou. Não é permitido trocar o voto.';
end;
$$;
create function public.has_voted(p_poll_id uuid) returns boolean
language plpgsql stable security definer set search_path = '' as $$
begin
  if not alianza_private.is_member() then raise exception 'Acesso restrito ao time.' using errcode = '42501'; end if;
  return exists (select 1 from public.votes where poll_id = p_poll_id and voter_id = auth.uid());
end;
$$;
create function public.poll_results(p_poll_id uuid)
returns table(player_id uuid, votes bigint, percentage numeric, winner boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not alianza_private.is_member() then raise exception 'Acesso restrito ao time.' using errcode = '42501'; end if;
  if not exists (select 1 from public.weekly_polls where id = p_poll_id and state = 'published') then
    raise exception 'Votação não publicada.';
  end if;
  return query
    with counts as (
      select c.player_id as candidate_id, count(v.voter_id) as amount
      from public.poll_candidates c left join public.votes v on v.poll_id = c.poll_id and v.player_id = c.player_id
      where c.poll_id = p_poll_id group by c.player_id
    ), totals as (
      select *, sum(amount) over () as total, max(amount) over () as highest from counts
    )
    select candidate_id, amount, coalesce(round(100.0 * amount / nullif(total, 0), 2), 0),
      (amount > 0 and amount = highest and now() >= (select closes_at from public.weekly_polls where id = p_poll_id))
    from totals order by amount desc, candidate_id;
end;
$$;
revoke all on function public.cast_vote(uuid, uuid), public.has_voted(uuid), public.poll_results(uuid) from public, anon, authenticated;
grant execute on function public.cast_vote(uuid, uuid), public.has_voted(uuid), public.poll_results(uuid) to authenticated;

-- Foto privada; escudos públicos exclusivamente para a agenda.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types) values
  ('player-photos', 'player-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('opponent-crests', 'opponent-crests', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']);
create policy alianza_photos_read on storage.objects for select to authenticated
using (bucket_id = 'player-photos' and alianza_private.is_member());
create policy alianza_photos_admin on storage.objects for all to authenticated
using (bucket_id = 'player-photos' and alianza_private.is_admin())
with check (bucket_id = 'player-photos' and alianza_private.is_admin() and name ~ '^players/[0-9a-f-]{36}/[a-zA-Z0-9_-]+\.(webp|jpg|jpeg|png)$');
create policy alianza_crests_admin on storage.objects for all to authenticated
using (bucket_id = 'opponent-crests' and alianza_private.is_admin())
with check (bucket_id = 'opponent-crests' and alianza_private.is_admin() and name ~ '^opponents/[0-9a-f-]{36}/[a-zA-Z0-9_-]+\.(webp|jpg|jpeg|png)$');

notify pgrst, 'reload schema';
commit;
select 'ETAPA 1 OK: tabelas, regras e buckets criados.' as resultado;
