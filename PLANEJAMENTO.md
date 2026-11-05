# Alianza Minas — plano de desenvolvimento

Versão inicial: 01/11/2026. Implementação da fundação visual iniciada em 02/11/2026.

## Progresso em 02/11/2026

- Entregue localmente: React/TypeScript/Vite, agenda responsiva com busca sem acentos, filtros de competição e mês, detalhes em modal e situações de partidas.
- Prévia interna explicitamente identificada com dados fictícios: início, elenco pesquisável e estado vazio de votação. Login, banco, administração e votação real ainda não implementados.
- Símbolo AM provisório: arquivos temporários das referências não estavam mais disponíveis; substituir pelo escudo original.
- Verificações: build de produção e três testes de filtros/ordenação/fuso passaram. Navegador validou busca, modal, navegação e filtro do elenco; agenda e elenco sem overflow horizontal na largura de celular testada.
- Próxima entrega: banco e políticas de autorização, autenticação e administração da agenda. Publicação externa ainda não realizada.

## 1. Objetivo e decisões confirmadas

Webapp com foco em celulares, identidade bordô, preto e dourado, baseado nos prints enviados. Área interna exclusiva para jogadores e comissão; agenda pública; um administrador gerencia o conteúdo. Meta de operação sem custo financeiro, dentro dos limites dos serviços gratuitos.

Os prints são referências visuais; nomes, fotos, datas e estatísticas são exemplos. Não copiar barras do sistema operacional nem controles do WhatsApp. Preservar legibilidade e adaptar o número de colunas à largura da tela.

## 2. Hipóteses de trabalho, ainda não aprovadas

- Incluir Craque da Galera na primeira versão; o usuário indicou prioridade provável.
- Votação interna, apenas para membros ativos autenticados. Abrir à torcida exige nova definição de acesso e prevenção de votos repetidos.
- Agenda pública mostra apenas próximos jogos publicados e alterações de situação; histórico e placares ficam internos até decisão.
- Jogadores e comissão têm as mesmas permissões de leitura e voto; apenas administrador altera conteúdo.
- Login preferencial por conta Google, com acesso interno autorizado pelo administrador. Validar disponibilidade de conta Google entre os membros antes de fechar essa escolha.
- Escalações e notícias entram após o núcleo de agenda e votação.

## 3. Escopo e requisitos

### Primeira entrega: acesso e agenda

- RF01: visitante consulta jogos publicados sem login, com adversário, escudos, data, hora, local, mando e competição ou amistoso.
- RF02: visitante visualiza situações agendado, adiado e cancelado; mudança de data não cria outra partida.
- RF03: membro autorizado entra na área interna; usuário não autorizado recebe estado de acesso pendente, sem dados privados.
- RF04: administrador autoriza e desativa membros e atribui perfil de jogador ou comissão. Usuários comuns não podem mudar sua própria permissão.
- RF05: administrador cadastra e edita adversários, locais, temporadas, competições e partidas; escolhe quando publicar uma partida.
- RF06: início interno mostra próximo confronto publicado e atalhos. Ausência de partidas gera mensagem adequada.

### Segunda entrega: elenco, resultados e votação

- RF07: administrador cadastra jogadores com nome, foto, número, posição e situação ativa/inativa. Jogador e conta de acesso são entidades distintas, com vínculo opcional.
- RF08: membro busca jogadores por nome e filtra posição.
- RF09: administrador encerra partida e registra placar, participantes e gols dos jogadores. Gols contra do adversário podem compor placar sem artilheiro do Alianza.
- RF10: estatísticas são derivadas de partidas encerradas; participação exige entrada em campo, não apenas convocação, como regra proposta. Filtros por temporada e competição, incluindo amistosos de forma explícita.
- RF11: administrador cria votação vinculada à partida, seleciona candidatos entre participantes e define abertura e encerramento.
- RF12: membro ativo registra um voto por votação. Proposta: voto definitivo, sem alteração; candidatos podem votar em si mesmos; validar essas regras antes da implementação.
- RF13: servidor valida prazo, elegibilidade e unicidade inclusive em pedidos simultâneos. Horário do aparelho não decide validade.
- RF14: parciais ficam ocultas; apuração agregada fica disponível aos membros após encerramento. Empate exibe todos os vencedores. Sem votos, não há vencedor. Não exibir escolha individual de outros membros.
- RF15: administrador pode cancelar uma votação com motivo, sem editar votos individuais. Candidatos ficam bloqueados após abertura; correção exige cancelar e criar nova votação.

### Complementos posteriores

- Notícias internas com título, resumo, conteúdo, imagem e publicação.
- Escalação por partida com titulares, reservas e formação.
- Histórico interno, artilharia e indicadores completos por período.
- Instalação como PWA, sem prometer uso offline de dados internos.

Fora do escopo inicial: push, SMS, WhatsApp automático, transmissão, pagamentos, loja, aplicativos de lojas e classificação automática de campeonatos externos.

## 4. Páginas previstas

- /agenda: única área de conteúdo pública inicialmente.
- /entrar: autenticação e orientação sobre autorização.
- /app: início interno.
- /app/elenco, /app/jogos, /app/votacoes: núcleo interno.
- /app/estatisticas: indicadores e artilharia.
- /admin: gestão de membros, jogadores, agenda, resultados e votações.
- Depois: /app/noticias e /app/escalacoes.

Menu interno proposto: Início, Jogos, Elenco, Votações e Mais. Interface pública tem agenda e entrada para membros.

## 5. Arquitetura proposta

- React + TypeScript + Vite para interface responsiva; CSS/Tailwind para identidade visual.
- Supabase para PostgreSQL, autenticação e armazenamento de imagens.
- Cloudflare Pages para publicar os arquivos estáticos, com endereço gratuito pages.dev, sujeito à disponibilidade do nome.
- Repositório Git para código e migrações. Desenvolvimento local com dados fictícios.
- Sem servidor próprio permanente. Operações privilegiadas usam funções seguras no backend; nenhuma chave administrativa vai ao navegador.
- Regras de acesso por linha (RLS) no banco e políticas de arquivos; esconder menus não é controle de acesso.
- Expor à consulta pública somente campos necessários de partidas publicadas. Separar dados públicos de notas e informações internas.
- Verificar membro ativo no acesso ao banco, para que desativação bloqueie novas consultas mesmo com sessão existente.
- Imagens internas em armazenamento privado; escudos usados na agenda podem ser públicos. Evitar cache persistente de dados internos no aparelho.

Escolha técnica proposta, sujeita à validação do login e das condições gratuitas no momento da publicação.

## 6. Modelo inicial de dados

| Entidade | Conteúdo principal |
|---|---|
| Membros | Conta autenticada, nome, papel e status de autorização |
| Autorizações | Identidade autorizada pelo administrador antes do primeiro acesso |
| Jogadores | Nome, foto, posição, número e situação; vínculo opcional com membro |
| Temporadas e competições | Agrupamento e filtros das partidas |
| Adversários e locais | Nome, escudo e informações de localização |
| Partidas | Adversário, mando, data/hora, local, competição, situação, publicação e placar |
| Participações | Partida, jogador e participação efetiva |
| Gols | Partida, jogador quando aplicável e tipo; pênaltis de desempate separados |
| Votações e candidatos | Partida, prazo, situação e jogadores elegíveis |
| Votos | Votação, membro e candidato; unicidade por votação e membro |
| Auditoria | Autor, data e ação nas alterações administrativas importantes |

Posteriormente: notícias e escalações. Datas armazenadas com fuso e exibidas em America/Sao_Paulo. Registros históricos não são apagados ao desativar jogadores. Números podem mudar por temporada; não usar número da camisa como identificador.

## 7. Sequência e critérios de aceite

1. **Fundação visual:** estrutura do projeto, rotas e componentes; protótipo de agenda, login e início com dados fictícios. Aceite: uso sem rolagem horizontal em celular e adaptação ao desktop.
2. **Banco e acesso:** migrações, login, primeiro administrador e políticas. Aceite: visitante e membro comum não conseguem consultar dados privados ou executar operações administrativas por chamadas diretas; desativado perde acesso.
3. **Agenda ponta a ponta:** cadastros administrativos e publicação. Aceite: administrador cria, publica, adia e cancela jogo; visitante vê somente informações públicas publicadas, com data e situação corretas.
4. **Elenco e resultados:** cadastro, participantes e placar. Aceite: corrigir partida recalcula totais sem duplicação; desativar jogador preserva histórico.
5. **Votação:** criação, voto e apuração. Aceite: voto duplicado ou simultâneo não duplica contagem; voto fora do prazo, de não membro ou em candidato inválido é recusado; parciais e votos individuais não vazam.
6. **Publicação piloto:** build, testes dos fluxos críticos, revisão em celular, configuração dos serviços e orientação ao administrador. Aceite: agenda abre sem login, área privada protegida, imagens corretas e exportação/restauração ensaiada.
7. **Complementos:** notícias, escalações e refinamentos após retorno do time.

Testes automatizados devem priorizar permissões, votação, estatísticas e fluxo de publicação; revisão manual cobre aparência, teclado, contraste, carregamento, listas vazias e falhas de rede. Dados de demonstração não entram como registros reais na produção.

## 8. Operação gratuita e seus limites

Consulta às fontes oficiais em 01/11/2026:

- Cloudflare Pages: requisições de arquivos estáticos são gratuitas e ilimitadas; funções têm limites separados. Plano proposto usa hospedagem estática.
- Supabase Free: 500 MB de banco, 1 GB de arquivos e cotas de transferência. Projetos gratuitos podem pausar após uma semana de inatividade.
- O SMTP padrão do Supabase tem restrições e não deve ser a base de e-mails de autenticação em produção. Login Google reduz essa dependência; caso login com senha seja necessário, planejar e validar provedor de e-mail e recuperação antes de entregar.
- Usar subdomínio gratuito; compra de domínio não integra o orçamento.
- Comprimir fotos antes de enviar, limitar tamanho e evitar hospedar vídeos. Monitorar uso; ao atingir limites, reduzir consumo ou reavaliar arquitetura, sem contratar plano automaticamente.
- Fazer exportação periódica do banco e cópia dos arquivos, com acesso restrito e procedimento de restauração. Não presumir backup automático no plano gratuito.
- Gratuidade depende das cotas e das condições dos provedores, não significa disponibilidade garantida indefinidamente. Não gerar tráfego artificial para contornar pausas.

Fontes:
- https://developers.cloudflare.com/pages/functions/pricing/
- https://supabase.com/pricing
- https://supabase.com/docs/guides/platform/free-project-pausing
- https://supabase.com/docs/guides/auth/auth-smtp

## 9. Pendências e ponto de partida

Antes da votação: confirmar público votante, voto próprio e possibilidade de alterar voto. Antes do login: confirmar uso de contas Google. Antes da publicação: confirmar se resultados serão públicos, obter escudo original e conteúdo real, configurar contas gratuitas sob controle do responsável pelo projeto e definir responsável pelas exportações.

Podemos começar pela fundação visual e agenda com dados fictícios sem essas respostas. Próxima tarefa: estruturar o frontend e implementar agenda pública responsiva, estados vazio/carregando/erro e navegação de acesso interno. Integração com banco vem na etapa seguinte.

## Atualização — administração local

Implementado painel `/admin` para cadastro, edição, rascunho, publicação e retirada de partidas; situações agendado, adiado e cancelado, com aviso obrigatório para alterações. Armazenamento local no navegador, sem autenticação real; integração Supabase ainda pendente. Filtros públicos de meses e competições agora derivam dos jogos publicados. Ciclo de criação/publicação/persistência/edição verificado no navegador.
