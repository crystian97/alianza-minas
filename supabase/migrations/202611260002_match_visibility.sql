begin;
-- Visibilidade na agenda não altera o histórico esportivo da votação.
create or replace function alianza_private.guard_match_history() returns trigger
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
    if tg_table_name = 'matches' and tg_op = 'UPDATE' then
      if (to_jsonb(new) - array['published','version','updated_at']) = (to_jsonb(old) - array['published','version','updated_at']) then
        return new;
      end if;
    end if;
    raise exception 'Partida e participações vinculadas a votação publicada têm histórico protegido.';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
notify pgrst,'reload schema';
commit;
select 'ETAPA 6 OK: publicação na agenda liberada sem alterar histórico.' as resultado;
