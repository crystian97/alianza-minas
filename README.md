# Alianza Minas

Primeira entrega local: frontend React + TypeScript + Vite. Todos os dados são fictícios. Não há autenticação, banco de dados nem votos persistidos nesta etapa.

## Executar

Requer Node.js 22.6+ e pnpm.

```sh
pnpm install
pnpm dev
```

Abra o endereço impresso no terminal. Comandos de verificação: `pnpm test` e `pnpm build`.

## Rotas

- `/agenda`: agenda pública com busca, filtros e detalhes.
- `/entrar`: apresentação do acesso de membros, ainda não conectado.
- `/demo`: prévia interna explicitamente pública, somente dados fictícios.
- `/demo/elenco`: elenco de demonstração com busca e posição.
- `/demo/votacoes`: estado sem votação, sem simular autenticação ou voto real.

O símbolo AM é provisório; substituir pelo escudo original quando disponível. Os dados de exemplo estão em `src/data.ts`. O layout usa fontes Google com fontes locais de fallback. A publicação futura em Cloudflare Pages pode usar comando `pnpm build` e diretório `dist`; o fallback de rotas está em `public/_redirects`.

Próxima etapa: Supabase, migrações e políticas de acesso, login e gestão administrativa da agenda. Não colocar dados privados no frontend ou considerar as rotas de demonstração protegidas. Consulte `PLANEJAMENTO.md`.

## Administração local

Acesse `/admin` ou use “Administração · demo” no rodapé. Permite cadastrar e editar partidas, salvar rascunhos, publicar/retirar da agenda e mudar situação com aviso. Dados ficam no localStorage deste navegador (chave `alianza.agenda.v1`); não há login nem controle real de permissões. Não usar dados privados. A agenda lê apenas registros publicados. Novos meses e competições alimentam os filtros automaticamente.

Validação em navegador: cadastro como rascunho, ausência na agenda, publicação, persistência após recarregar, edição para adiado e retirada da agenda. Um registro identificado como teste foi mantido como rascunho. Gestão de membros, elenco, resultados e votação ainda pendente.

## Jogadores e fotos

Acesse `/admin/jogadores` pelo botão “Gerenciar jogadores e fotos” no painel. O CRUD permite nome, camisa (1 a 99), posição, situação, envio/troca/remoção de foto e exclusão com confirmação. Inativos aparecem somente na administração. `/demo/elenco` consulta os cadastros ativos.

Os jogadores e as imagens são salvos em IndexedDB no navegador. Upload aceita JPEG, PNG e WebP até 5 MB, com otimização para até 900 pixels na maior dimensão. Autenticação e sincronização remota estão pendentes. O plano de banco e Storage privado está em `INTEGRACAO-BANCO.md`.

Oito testes automatizados cobrem agenda, CRUD persistente, exclusão, validações e limites de upload. O navegador validou envio de imagem, carregamento após recarregar e inativação. Um cadastro “Teste de foto” ficou inativo como registro da verificação local.
