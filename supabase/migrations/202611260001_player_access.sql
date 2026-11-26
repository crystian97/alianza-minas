begin;
-- Lookup limitado ao administrador; nunca expõe Auth à listagem do elenco.
create function public.player_access_target(p_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p public.players; e text; u uuid;
begin
 if not alianza_private.is_admin() then raise exception 'Somente administrador.' using errcode='42501'; end if;
 select * into strict p from public.players where id=p_id;
 select lower(btrim(email)) into e from public.player_private_details where player_id=p_id;
 if not p.active or coalesce(e,'')='' then raise exception 'Ative o jogador e salve um e-mail antes de convidar.'; end if;
 select id into u from auth.users where lower(email)=e;
 if p.profile_id is not null and p.profile_id is distinct from u then raise exception 'O e-mail difere da conta vinculada. Gerencie o acesso em Usuários.'; end if;
 return jsonb_build_object('email',e,'user_id',u,'name',p.name,'version',p.version);
end; $$;

create function public.link_player_access(p_id uuid,p_user_id uuid,p_version integer) returns void
language plpgsql security definer set search_path='' as $$
declare p public.players; e text; user_email text; member_role text;
begin
 -- Serializa com manage_member e impede rebaixar o último administrador.
 lock table public.profiles in share row exclusive mode;
 if not alianza_private.is_admin() then raise exception 'Somente administrador.' using errcode='42501'; end if;
 select * into strict p from public.players where id=p_id for update;
 if p.version<>p_version then raise exception 'Jogador alterado; recarregue.' using errcode='40001'; end if;
 if not p.active then raise exception 'Jogador inativo.'; end if;
 select lower(btrim(email)) into e from public.player_private_details where player_id=p_id for update;
 select lower(email) into user_email from auth.users where id=p_user_id;
 if e is null or e='' or user_email is distinct from e then raise exception 'E-mail da conta não corresponde ao atleta.'; end if;
 if p.profile_id is not null and p.profile_id<>p_user_id then raise exception 'Jogador já vinculado a outra conta.'; end if;
 select role into member_role from public.profiles where id=p_user_id;
 if member_role is distinct from 'player' then raise exception 'Conta já possui outro perfil. Gerencie-a em Usuários.'; end if;
 update public.players set profile_id=p_user_id where id=p_id;
 update public.profiles set active=true,display_name=p.name where id=p_user_id;
end; $$;
revoke all on function public.player_access_target(uuid),public.link_player_access(uuid,uuid,integer) from public,anon;
grant execute on function public.player_access_target(uuid),public.link_player_access(uuid,uuid,integer) to authenticated;
notify pgrst,'reload schema';
commit;
select 'ETAPA 5 OK: vínculo seguro de jogador e usuário disponível.' as resultado;
