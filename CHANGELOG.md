# Histórico de alterações

## 2026-11-14 21:05 (Brasília) — chore

- Formatação global com `prettier --write .`, incluindo código, testes, documentação e configurações. `npm run format:check`, `npm run typecheck`, `npm test` (147 casos) e `npm run build` passaram após a formatação. A mudança amplia o diff para arquivos anteriores à revisão móvel.

## 2026-11-14 20:02 (Brasília) — fix

- Interface móvel: saída da conta visível, cartões em uma coluna nas telas estreitas, indicação de rolagem e regiões de tabela acessíveis por teclado, e seleção de datas com alvos de pelo menos 48 px. Arquivos principais: `src/app/layout.tsx`, `src/app/globals.css`, páginas com tabelas e `src/components/multi-date-picker.tsx`.
- Validação: 147 testes, checagem de tipos e build aprovados; checagem visual de CSS em Chromium nas larguras 320, 390, 768 e 1280 px. A verificação de formatação aponta desvios também em arquivos não modificados. A varredura `cs scan` não foi concluída: o diretório padrão falhou por proteção de credenciais e a execução em diretório isolado ficou sem resultado até ser interrompida.
