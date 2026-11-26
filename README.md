# Alianza Minas

Webapp React + TypeScript + Vite integrado ao Supabase (Auth, PostgreSQL e Storage).

## Executar

Requer Node.js 22.6+ e pnpm. Instale com `pnpm install`, copie `.env.example` para `.env.local` e preencha a URL e a chave **publicável**. Execute `pnpm dev` e abra o endereço exibido. Nunca colocar senha do banco, service_role ou chave secreta no frontend.

## Banco

Aplicar em ordem as migrações de `supabase/migrations`, seguindo `supabase/README.md`. A segunda migração adiciona gravação transacional de jogador + dados pessoais e exclusão com controle de versão. O proprietário confirmou a aplicação das quatro migrações no projeto remoto e a criação do primeiro administrador.

## Rotas e acesso

- `/agenda`: partidas publicadas, consulta online sem login, filtros e placar dos jogos finalizados. Atualiza ao abrir, ao voltar à aba e a cada minuto.
- `/entrar`: login por e-mail/senha no Supabase. A conta precisa de perfil ativo autorizado pelo administrador. `/cadastro` solicita acesso pendente; `/esqueci-senha` e `/recuperar` fazem recuperação por e-mail.
- `/time`: inicial com próximo confronto, totais dos jogos publicados/finalizados e atalhos.
- `/time/elenco`: elenco ativo com fotos privadas via URLs assinadas de cinco minutos.
- `/time/votacoes`: consulta de votações publicadas, totais e voto definitivo com confirmação. Empatados são reconhecidos após encerramento. O perfil admin acompanha resultados; player/staff votam.
- `/admin`: CRUD de jogos, adversário vinculado, data em Brasília, rascunho/publicação, situação, placar, edição e exclusão sem histórico.
- `/admin/jogadores`: CRUD, dados pessoais exclusivos do admin, foto otimizada, inativação e controle de versão. Usa `save_player` para não deixar dados gravados parcialmente. Convites vinculam o atleta à conta de jogador pela Edge Function `invite-player`; configuração em `supabase/CONVITES.md`.
- `/admin/adversarios`: nome, sigla, cidade, cor e situação. Exclusão bloqueada quando houver jogos vinculados. Escudo opcional com upload, troca e remoção; sigla exibida quando não houver imagem.
- `/admin/usuarios`: aprovar acessos, desativar membros e definir jogador/comissão/admin; proteção do último administrador ativo.
- `/admin/participacoes`: marcar atletas e gols dos jogos finalizados, com controle de versão e limite pelo placar.
- `/admin/votacoes`: criar, editar e excluir rascunhos; selecionar jogos/candidatos elegíveis e publicar. Publicação fixa candidatos, prazo e histórico.
- `/admin/migracao`: cópia JSON dos dados locais e fotos, importação individual explícita. Nunca limpa IndexedDB ou localStorage. Exemplos identificados; jogos importados como rascunho. IDs estáveis evitam duplicação por reenvio; registros já existentes não são sobrescritos.
- As URLs antigas `/demo/*` passam pela mesma proteção das rotas internas.

O frontend verifica o perfil para navegação; a proteção efetiva é feita por RLS no banco e no Storage. Sessões e papéis são reavaliados ao voltar à aba e periodicamente. Sair remove a sessão deste navegador e desmonta o conteúdo privado. O aplicativo não volta ao armazenamento local quando o Supabase falha.

## Fotos e falhas

Entrada JPEG/PNG/WebP até 5 MB, otimizada para até 900 pixels. Upload em caminho novo antes da gravação; foto anterior removida somente depois de salvar. Falha na limpeza é apresentada ao administrador. Em erro de rede durante a gravação, o novo arquivo pode ficar órfão: não é removido automaticamente porque a transação pode ter sido confirmada. Reconciliar arquivos com `players.photo_path` antes de removê-los. Falha na prévia assinada não implica remover a foto ao editar outros campos.

## Testar

- `pnpm test`: regras de agenda, validação e preservação do armazenamento legado (9 testes).
- `pnpm test:db`: esquema, RLS, CRUDs, votação, transações de jogador e conflito de versões em PostgreSQL local via PGlite. Auth/Storage simulados; scripts SQL também disponíveis para execução no Supabase.
- `pnpm exec playwright test`: navegador Chrome instalado; contratos HTTP do Supabase simulados, sem gravar no projeto real. Cobre acesso, login, CRUD de jogador/foto, jogo publicado, aprovação de membro, participações, publicação de votação, solicitação de acesso, recuperação, escudos e inicial mobile (7 testes).
- `pnpm build`: TypeScript e build de produção.

Validação remota: API pública da agenda respondeu; acesso anônimo a jogadores/dados pessoais foi bloqueado. Login real confirmado pelo responsável. Cadastro “Teste de integração Supabase”, camisa 99, criado inativo para verificar persistência após recarregar. As verificações locais não substituem testes com sessões reais de jogador/comissão e dois dispositivos.

## Preparar o teste com o time

1. As etapas SQL 1 a 5 já foram confirmadas no Supabase pelo responsável. Não reaplicar as migrações.
2. Publicar o diretório dist após pnpm build, configurando as duas variáveis de .env.example no ambiente de build. O servidor deve devolver index.html nas rotas da SPA; public/_redirects já atende hosts que usam esse formato.
3. No Supabase Auth, configurar Site URL com o endereço publicado e autorizar os redirects desse domínio para /entrar e /recuperar. Verificar envio de confirmação e recuperação de e-mail antes de convidar usuários.
4. Salvar o atleta com e-mail e usar Convidar para acessar. Para contas existentes, o botão vincula e ativa sem reenviar convite. O cadastro público /cadastro continua sujeito à aprovação em Usuários.
5. Testar em outro navegador com jogador/comissão: somente agenda sem login, área interna após ativação, dados pessoais restritos ao admin.
6. Fluxo semanal: finalizar placar em Jogos → registrar Participações → criar rascunho em Votações → conferir semana/prazo/candidatos → publicar. Jogador/comissão votam; admin acompanha resultados.

A confirmação por e-mail depende da configuração de envio do projeto Supabase. O teste automatizado simula os endpoints e não verifica entrega de e-mails reais. O responsável confirmou recebimento de convite, definição de senha e um voto visível nos resultados. Publicação do frontend e configuração de SMTP para os destinatários do time permanecem pendentes.

## Evoluções pendentes

Calendário mensal, estatísticas completas, escalações e notícias. Não estão incluídos nesta entrega dos módulos administrativos de usuários, participações e votação.
