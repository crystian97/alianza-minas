# Integração do elenco e das fotos

Planejamento de 18/11/2026. A implementação atual usa IndexedDB para guardar cada jogador e sua foto no navegador. Os jogos continuam no localStorage. As telas administrativas de demonstração ainda precisam de autenticação para uso real. A troca de armazenamento ficará concentrada em `src/lib/players.ts`.

## Escolha proposta

Supabase com PostgreSQL, Auth e Storage privado. Esta é a recomendação para implementação, ainda sem projeto remoto configurado. O modelo relacional atende jogadores, participações, gols e candidatos das votações. Firebase é uma alternativa possível com Firestore, Authentication e Storage, mas o envio de fotos exige o plano Blaze, vinculado ao faturamento. Isso pesa contra a exigência de custo zero.

Fontes oficiais consultadas

- https://supabase.com/docs/guides/storage/security/access-control
- https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024

## Modelo proposto

- `members`: ID de autenticação, papel (administrador, comissão ou jogador), autorização ativa. O administrador controla os papéis.
- `players`: UUID, nome, número, posição, ativo, caminho da foto, versão, datas de criação/atualização e vínculo opcional a um membro.
- `player_private_details`: vínculo único ao jogador, CPF, e-mail, endereço, nome e telefone do contato de emergência. Separar estes dados do elenco consultado pelos membros, com leitura e escrita exclusivas do administrador via RLS. Excluir junto ao cadastro quando a exclusão for permitida.
- `player_seasons`: evolução futura para número da camisa e vínculo por temporada.
- `match_players`: vínculo futuro entre partida e atleta. Jogos e gols serão derivados dos registros das partidas.
- Bucket privado `player-photos`, com arquivos em `players/<uuid>/<uuid-da-foto>.webp`. Guardar o caminho no banco, sem URL assinada persistente ou imagem em base64.

## Permissões

1. Configurar Auth e o primeiro administrador antes de liberar cadastro real.
2. Habilitar RLS nas tabelas. Administrador autorizado escreve, membros ativos consultam o elenco ativo. Visitantes consultam somente a agenda publicada.
3. Aplicar políticas também no Storage. Somente administradores enviam, substituem e removem imagens. Membros autorizados recebem URLs de curta duração ou downloads autenticados. O prazo de uma URL assinada limita o tempo de acesso após revogação do membro.
4. Usar chave publicável no frontend com RLS. Chaves administrativas permanecem no backend.
5. Validar nome, posição, camisa e tamanho/tipo de arquivo no servidor além das validações do formulário.
6. Validar também CPF, e-mail e o par nome/telefone de emergência no servidor. Testar que membros e visitantes não conseguem consultar os dados privados, inclusive por chamadas diretas à API. Na demonstração local, estes campos aparecem somente no formulário administrativo, mas ainda não há controle de acesso real.

## Fluxo de foto e recuperação de falhas

1. Validar e otimizar a imagem no navegador, preservando transparência quando possível. Limite atual de entrada de 5 MB e maior dimensão de 900 pixels.
2. Enviar para um caminho novo, evitando sobrescrever a imagem que ainda aparece no cadastro.
3. Atualizar `photo_path` com controle de versão para detectar edições concorrentes. Em conflito, oferecer recarregar e revisar, sem sobrescrever silenciosamente.
4. Se a atualização falhar, remover o novo arquivo ou registrar sua limpeza para nova tentativa. Manter a foto anterior vinculada.
5. Depois da atualização confirmada, remover a foto antiga. Falha na limpeza deve permitir nova tentativa sem desfazer o cadastro salvo.
6. Ao excluir jogador sem histórico, remover o cadastro e agendar a limpeza da foto. Com participações históricas, oferecer inativação e bloquear exclusão que apagaria o histórico.

## Migração sem perda e sem duplicação

- Exportar um pacote dos jogadores locais e suas fotos antes da mudança.
- Apresentar seleção dos cadastros a importar. Não importar automaticamente os exemplos fornecidos na demonstração.
- Manter um identificador de importação por origem, inclusive para IDs `example-*`, mapeando para UUIDs remotos. Repetir uma importação não deve duplicar atletas.
- Fazer upload das fotos, gravar cada atleta, conferir contagens e abrir as imagens no destino. Manter cópia local até validar a migração.
- Registrar falhas por jogador e permitir repetir somente as pendências.

## Ordem de entrega e validação

1. Criar projeto gratuito sob controle do responsável, migrações SQL, Auth e RLS.
2. Conectar listagem e CRUD ao Supabase mantendo contratos assíncronos da camada de dados.
3. Conectar o bucket privado e o fluxo seguro de substituição de fotos.
4. Importar os cadastros selecionados e validar em dois dispositivos.
5. Testar visitante sem acesso ao elenco, membro sem escrita, administrador com CRUD, acesso revogado, arquivos inválidos, falha de upload, edição concorrente e preservação do histórico.
6. Configurar exportação periódica do banco e cópia dos arquivos. Acompanhar armazenamento e transferência no plano gratuito, incluindo a condição de pausa por inatividade.

Se Firebase for escolhido, manter os mesmos contratos de UI, representar atletas na coleção `players`, aplicar Security Rules a documentos e arquivos, usar transações para versão e planejar limpeza compensatória de uploads. A ativação do Blaze deve ser uma decisão explícita do responsável, considerando a possibilidade de cobrança.
