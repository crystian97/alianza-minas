import {createClient} from 'npm:@supabase/supabase-js@2.119.2';

const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,x-client-info,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS'};
Deno.serve(async req=>{
 const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}});
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.method!=='POST')return reply({error:'Método não permitido.'},405);
 try{
  const url=Deno.env.get('SUPABASE_URL')!;
  const authorization=req.headers.get('Authorization')??'';
  const userClient=createClient(url,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false}});
  const {data:session,error:authError}=await userClient.auth.getUser();
  if(authError||!session.user)return reply({error:'Entre novamente.'},401);
  const {playerId}=await req.json();
  if(typeof playerId!=='string'||!/^[0-9a-f-]{36}$/i.test(playerId))return reply({error:'Jogador inválido.'},400);
  const {data:target,error}=await userClient.rpc('player_access_target',{p_id:playerId});
  if(error)return reply({error:error.message},error.code==='42501'?403:400);
  let userId=target.user_id;let invited=false;
  if(!userId){
   // URL configurada no servidor: não aceitar redirect arbitrário do navegador.
   const site=Deno.env.get('APP_URL');
   if(!site)return reply({error:'Configure APP_URL na função antes de enviar convites.'},503);
   const admin=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
   const result=await admin.auth.admin.inviteUserByEmail(target.email,{data:{full_name:target.name},redirectTo:`${site.replace(/\/$/,'')}/recuperar`});
   if(result.error)return reply({error:`Convite não enviado: ${result.error.message}`},400);
   userId=result.data.user.id;invited=true;
  }
  const linked=await userClient.rpc('link_player_access',{p_id:playerId,p_user_id:userId,p_version:target.version});
  if(linked.error)return reply({error:`${invited?'Convite enviado, mas o vínculo ficou pendente. ':''}${linked.error.message} Recarregue e tente vincular novamente.`},409);
  return reply({message:invited?'Convite enviado e jogador vinculado. Ele deve abrir o e-mail para definir a senha.':'Conta existente vinculada e ativada como jogador. Use o login ou a recuperação de senha; nenhum novo convite foi enviado.'});
 }catch{return reply({error:'Não foi possível concluir o convite. Confira a configuração da função e tente novamente.'},500);}
});
