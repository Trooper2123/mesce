# Histórico de alterações

## 2026-11-27 17:40 (Brasília) — fix

- `src/components/calendar.tsx`: visão dos impedimentos em lista como a agenda do mês, com dia/horário à esquerda, evento/local, quantidade e nomes dos impedidos e atalho por evento. Sem alterar a visão das demais agendas. Testes de renderização da lista, estado vazio e navegação aprovados; validação visual continua pendente.
- `src/components/main-navigation.tsx` e `src/app/[section]/page.tsx`: atalho Impedimentos → Registrar ausência para ministros e coordenação, com botão antes do calendário. O destino existente `?new=1#cadastro` expande o formulário e permite acesso direto sem percorrer registros.
- `src/app/globals.css`: cabeçalho móvel com logo e botão Menu na primeira linha; navegação e saída em linhas de largura total. Links e expansores móveis com altura mínima de 48 px e textos sem corte horizontal.
- Validação: tipos, build, teste de navegação e formatação do CSS aprovados. Execução direta da suíte: 154/155 testes passaram; falha preexistente no convite de calendário (espera horário, implementação gera data). `npm test` bloqueado pelo arquivo ausente `scripts/windows-user-info.cjs`.
- Validação visual pendente: Chromium local sem executável; download do navegador bloqueado por HTTP 403. Node disponível 24.22.3, enquanto package.json exige 26.x. Ferramentas de auditoria não disponíveis; revisão manual do diff restrito a CSS, sem alterações de autenticação, dados ou dependências. PR de revisão solicitado explicitamente pelo usuário com as limitações acima; sem publicação em produção.
## 2026-11-27 21:01 (Brasília) — chore

- `.github/workflows/ci.yml`: atualiza `actions/checkout` e `actions/setup-node` de v4 para v5, cujo runtime é Node.js 24. Preserva Node 24 do projeto, cache npm, permissões somente leitura e credenciais não persistidas.
- Validação: manifests oficiais das duas actions confirmam `runs.using: node24`; YAML e formatação verificados. Execução remota pendente. Revisão manual sem novos segredos, permissões ou comandos; ferramentas de auditoria especializadas indisponíveis. A falha de formatação no job indicado é anterior e independente desta atualização.

## 2026-11-14 21:05 (Brasília) — chore

- Formatação global com `prettier --write .`, incluindo código, testes, documentação e configurações. `npm run format:check`, `npm run typecheck`, `npm test` (147 casos) e `npm run build` passaram após a formatação. A mudança amplia o diff para arquivos anteriores à revisão móvel.

## 2026-11-14 20:02 (Brasília) — fix

- Interface móvel: saída da conta visível, cartões em uma coluna nas telas estreitas, indicação de rolagem e regiões de tabela acessíveis por teclado, e seleção de datas com alvos de pelo menos 48 px. Arquivos principais: `src/app/layout.tsx`, `src/app/globals.css`, páginas com tabelas e `src/components/multi-date-picker.tsx`.
- Validação: 147 testes, checagem de tipos e build aprovados; checagem visual de CSS em Chromium nas larguras 320, 390, 768 e 1280 px. A verificação de formatação aponta desvios também em arquivos não modificados. A varredura `cs scan` não foi concluída: o diretório padrão falhou por proteção de credenciais e a execução em diretório isolado ficou sem resultado até ser interrompida.
