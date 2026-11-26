-- ETAPA 3: novas funções para salvar jogador e dados pessoais juntos.
-- Não apaga cadastros; pode ser executado novamente.
begin;
create or replace function public.save_player(p_player jsonb, p_details jsonb, p_expected_version integer default null)
returns public.players language plpgsql security invoker set search_path = '' as $$
declare saved public.players; target uuid := (p_player->>'id')::uuid;
begin
  if not alianza_private.is_admin() then raise exception 'Acesso exclusivo do administrador.' using errcode = '42501'; end if;
  if p_expected_version is null then
    insert into public.players(id, name, number, position, active, photo_path)
    values(target, btrim(p_player->>'name'), (p_player->>'number')::smallint, p_player->>'position',
      (p_player->>'active')::boolean, p_player->>'photo_path') returning * into saved;
  else
    update public.players set name = btrim(p_player->>'name'), number = (p_player->>'number')::smallint,
      position = p_player->>'position', active = (p_player->>'active')::boolean, photo_path = p_player->>'photo_path'
    where id = target and version = p_expected_version returning * into saved;
    if not found then raise exception 'Cadastro alterado ou removido por outra pessoa. Recarregue antes de editar.' using errcode = '40001'; end if;
  end if;
  insert into public.player_private_details(player_id, cpf, email, address, emergency_contact_name, emergency_contact_phone)
  values(target, coalesce(p_details->>'cpf',''), coalesce(p_details->>'email',''), coalesce(p_details->>'address',''),
    coalesce(p_details->>'emergency_contact_name',''), coalesce(p_details->>'emergency_contact_phone',''))
  on conflict(player_id) do update set cpf = excluded.cpf, email = excluded.email, address = excluded.address,
    emergency_contact_name = excluded.emergency_contact_name, emergency_contact_phone = excluded.emergency_contact_phone;
  return saved;
end;
$$;
create or replace function public.delete_player(p_id uuid, p_expected_version integer)
returns text language plpgsql security invoker set search_path = '' as $$
declare old_path text;
begin
  if not alianza_private.is_admin() then raise exception 'Acesso exclusivo do administrador.' using errcode = '42501'; end if;
  delete from public.players where id = p_id and version = p_expected_version returning photo_path into old_path;
  if not found then raise exception 'Cadastro alterado ou removido por outra pessoa. Recarregue antes de excluir.' using errcode = '40001'; end if;
  return old_path;
end;
$$;
revoke all on function public.save_player(jsonb,jsonb,integer), public.delete_player(uuid,integer) from public, anon, authenticated;
grant execute on function public.save_player(jsonb,jsonb,integer), public.delete_player(uuid,integer) to authenticated;
notify pgrst, 'reload schema';
commit;
select 'ETAPA 3 OK: gravação transacional de jogadores disponível.' as resultado;
