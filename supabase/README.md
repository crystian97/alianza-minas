# Aplicar o banco do Alianza Minas

Estado em 25/11/2026: etapas 1, 2, 3 e 4 confirmadas pelo responsável no Supabase. Frontend agora usa Auth, consultas online, CRUDs de jogadores/adversários/jogos e Storage para fotos.

## 1. Criar estrutura

No projeto correto, abra SQL Editor, crie uma nova consulta, copie **todo** o conteúdo de `migrations/202611250001_initial.sql` e execute como `postgres` pelo botão Run. Não selecione apenas parte do texto.

Resultado esperado: `ETAPA 1 OK: tabelas, regras e buckets criados.`

Execute esta migração uma única vez. Se já foi aplicada, não precisa executar novamente. O script usa uma transação e não remove tabelas existentes. Se houver erro, envie o erro completo antes de prosseguir; não apague objetos para contorná-lo.

São criadas 10 tabelas: profiles, players, player_private_details, opponents, matches, match_players, weekly_polls, poll_matches, poll_candidates e votes. Todas com RLS e privilégios explícitos. As funções internas ficam no schema `alianza_private`, que não deve ser adicionado aos schemas expostos pela Data API.

## 2. Validar no Supabase

Abra outra consulta. Copie **todo** o conteúdo de `tests/validate_cruds.sql` e execute como `postgres`.

Resultado esperado: `ETAPA 2 OK: CRUDs, permissões, voto único, prazo e empate validados. Dados de teste revertidos.`

O teste cria registros temporários dentro de uma transação, simula papéis `anon` e `authenticated` e termina em ROLLBACK. As fixtures em Auth não têm senha nem identidade de login, não enviam emails e não permanecem no banco. Não execute trechos isolados. Para simular o fim da votação, o teste altera o prazo como postgres com o gatilho temporariamente desabilitado, dentro da mesma transação revertida.

Cobertura: cadastro, consulta, edição e exclusão de registros sem histórico; restrição de exclusão de jogador/adversário vinculado; cascata de dados pessoais e rascunhos; validações de CPF, email e contato; agenda pública sem rascunhos; membro sem escrita nem dados pessoais; prevenção de autopromoção; acesso revogado; participação exigida para candidato; voto em si próprio, voto único, imutabilidade, totais durante votação, empate e encerramento sem votos. Confere configurações dos buckets; não testa envio real de arquivos.

## 3. Primeiro administrador e integração (próxima etapa)

Atualização: o primeiro administrador já foi criado. Executar `migrations/202611250002_player_transactions.sql` para adicionar `save_player` e `delete_player`, com permissão apenas para admin e atualização atômica dos dados privados. `tests/player_transactions.sql` verifica falhas parciais, versões e permissões, revertendo suas fixtures. A etapa 3 também foi confirmada no projeto remoto.

Depois de passar os dois scripts, criar a conta real em Authentication e conceder papel admin somente ao UUID confirmado pelo responsável. Nenhuma conta recebe admin automaticamente; novas contas geram um perfil inativo de jogador, ignorando papéis enviados nos metadados.

Conectar login e rotas protegidas antes de trocar os repositórios locais pelos remotos. Preservar IndexedDB/localStorage e oferecer importação explícita. Salvar dados do jogador e detalhes pessoais numa operação transacional antes de liberar esse CRUD remoto. Nas edições, usar a coluna version para detectar conflitos e conferir se a atualização afetou a linha esperada.

## 4. Módulos administrativos

Aplicar uma única vez migrations/202611250003_admin_modules.sql. A aplicação remota foi confirmada pelo responsável com “ETAPA 4 OK”. Adiciona gestão de membros, participações e votações por funções transacionais, retirando escrita direta nessas tabelas. O frontend usa essas funções.

O teste tests/admin_modules.sql é executado no banco local isolado por pnpm test:db. Os testes antigos devem rodar na ordem do runner: a etapa 4 revoga permissões diretas usadas nas validações iniciais.

## Contratos e decisões do esquema

- `profiles`: admin, staff (comissão), player; só jogadores/comissão ativos votam. Admin é o papel de gestão, sem voto por padrão.
- `players`: informações esportivas consultáveis pelo time, inclusive inativos para histórico. A tela do elenco deve filtrar ativos. Dados pessoais ficam em tabela separada, exclusiva de admin.
- `opponents`: apenas dados esportivos, sem telefone de responsável. Visitantes consultam adversários vinculados a jogos publicados.
- `matches`: datas em timestamptz; exibir em America/Sao_Paulo. Finalizado exige placar. Adiado/cancelado exige aviso. Participações são registradas em match_players. Gols contra e atribuição de gols ainda precisam de regra antes da artilharia completa.
- `weekly_polls`: uma por semana, identificada pela segunda-feira local. Adicionar partidas e candidatos no rascunho; publicar só com partidas finalizadas da semana e candidatos que participaram. Depois de publicada, a votação, os vínculos e o histórico das partidas ficam congelados. Ajustes excepcionais exigem uma futura rotina administrativa auditada.
- `cast_vote(p_poll_id, p_player_id)`: usa o usuário da sessão, sem aceitar voter_id fornecido pelo cliente. A chave primária impede dois votos inclusive em requisições concorrentes. Chamadas diretas à tabela votes não são permitidas aos usuários da aplicação.
- `has_voted(p_poll_id)`: retorna somente se o usuário atual participou.
- `poll_results(p_poll_id)`: retorna player_id, votes, percentage, winner. Totais visíveis ao time durante a votação; após o prazo, todos empatados na liderança com pelo menos um voto recebem winner=true. Sem votos, nenhum vencedor.
- Quem administra o banco diretamente mantém acesso técnico aos registros; os votos individuais não aparecem na API dos membros ou do admin da aplicação.
- `player-photos`: privado; leitura por membros ativos e escrita por admin. `opponent-crests`: público para escudos da agenda, escrita por admin. Ambos limitados a JPEG/PNG/WebP de até 5 MB.
- Caminhos: `players/<id>/<arquivo>.webp` e `opponents/<id>/<arquivo>.webp`. Guardar caminho no banco, não URL assinada. Troca usa arquivo novo; só remover foto anterior após confirmar a atualização. Exclusão SQL de jogador não apaga o arquivo físico: a integração precisa fazer limpeza via Storage API.

## Verificação local

`pnpm test:db` executa PostgreSQL em memória via PGlite. Auth e Storage são simulados apenas para conferir SQL e RLS. Ainda validar no projeto remoto: criação/login de conta, RLS via API com sessões reais, uploads/URLs assinadas, duas requisições simultâneas e CRUDs pelas telas.

Referências: [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [funções](https://supabase.com/docs/guides/database/functions), [Storage](https://supabase.com/docs/guides/storage/security/access-control).

## 6. Publicação de jogos vinculados à votação

Aplicar migrations/202611260002_match_visibility.sql no SQL Editor. Corrige o bloqueio indevido ao publicar/retirar da agenda um jogo usado em votação publicada. Placar, adversário, data e participações continuam protegidos. Validado localmente; aplicação remota ainda pendente.
