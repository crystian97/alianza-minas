# Ativar convites de jogadores

O responsável confirmou a etapa 5 e a publicação da função invite-player no projeto remoto em 26/11/2026. Também confirmou recebimento do convite e definição da senha. Os passos abaixo servem para reproduzir a configuração; não reaplicar a migração já executada.

1. No SQL Editor do Supabase, execute por inteiro migrations/202611260001_player_access.sql. Espere ETAPA 5 OK.
2. No terminal, na pasta do projeto, execute:

```powershell
npx supabase login
npx supabase functions deploy invite-player --project-ref zaxmaetkmkfzflyqsxzk
npx supabase secrets set APP_URL=http://127.0.0.1:5173 --project-ref zaxmaetkmkfzflyqsxzk
```

Não desligue a verificação JWT. A função também valida a sessão com getUser e as RPCs verificam o administrador ativo. A chave service_role é usada só na função; nunca deve ir para VITE_*.

Alternativa pelo painel: Edge Functions → criar função invite-player → colar functions/invite-player/index.ts → publicar com verificação JWT; definir APP_URL em Secrets.

3. Em Authentication → URL Configuration, autorize http://127.0.0.1:5173/recuperar. Confira o template de convite para usar o link de confirmação fornecido pelo Supabase.
4. Configure e teste o envio de e-mail/SMTP. O envio padrão pode restringir destinatários; não considerar entrega real validada apenas pelo teste local.
5. Administração → Jogadores e fotos → editar atleta → salvar e-mail → Convidar para acessar. O convite ativa o perfil player e vincula o atleta. O destinatário abre o e-mail, define a senha e entra no time.
6. Conta já existente: vincula e ativa sem enviar novo convite. Usar login ou recuperação; não altera contas admin/staff. Reativar acesso é uma ação explícita do administrador. Mudar o e-mail esportivo não muda o e-mail de login de uma conta vinculada.

Antes de enviar para Darwen, publique o frontend e troque APP_URL pelo endereço HTTPS publicado. Autorize esse domínio com /recuperar e /entrar nas URLs de redirecionamento. Um link localhost só abre o aplicativo no computador em que o servidor está rodando.

Teste de aceitação: convite com e-mail real → recebimento → definir senha → abrir elenco → votar uma vez → recarregar e verificar bloqueio de novo voto → confirmar que o jogador não abre Administração. Ainda depende da configuração e publicação remotas.

Falha após envio do e-mail: a conta pode ter sido criada sem vínculo. Recarregar e repetir a ação usa a conta existente; não excluir automaticamente a conta. Cadastros sem e-mail ou inativos não são convidados. Inativar atleta e desativar login continuam operações separadas; revogue o acesso em Usuários.
