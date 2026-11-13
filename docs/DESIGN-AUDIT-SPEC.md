# Especificação — ajustes visuais do design audit

## Objetivo e limites

Tornar a navegação, a ação principal e os estados das telas do MESCE mais claros em celular, tablet e desktop. O trabalho preserva rotas, permissões, textos necessários à operação, dados, validações, Server Actions e regras de escala. Não inclui funcionalidades novas, modo escuro nem reformulação dos fluxos de cadastro.

Base: auditoria de `src/app/layout.tsx`, `src/app/globals.css`, páginas da visão geral, escalas, relatórios e estados comuns. A auditoria foi estática: a validação visual no navegador ainda é parte obrigatória do aceite. Não há `DESIGN_SYSTEM.md`, `APP_FLOW.md`, `PRD.md`, `FRONTEND_GUIDELINES.md`, `TECH_STACK.md`, `progress.txt` ou `LESSONS.md` neste repositório; `README.md` e os documentos em `docs/` servem como referência de produto.

## DS-01 — Navegação e orientação (fase 1)

- **Atual:** o layout apresenta até 14 destinos na lateral; abaixo de 760 px, o menu vira uma faixa com rolagem horizontal. Nenhum link indica a rota atual visualmente ou por `aria-current`.
- **Desejado:** o destino atual fica evidente por texto, forma e cor, com `aria-current="page"`. Em telas estreitas, todos os destinos permitidos pelo perfil ficam acessíveis por um controle de menu identificado, sem depender de rolagem horizontal para descobri-los. O menu não cobre o conteúdo quando fechado e não cria segundo foco invisível.
- **Perfis:** coordenação conserva os destinos atuais; ministro conserva somente os destinos permitidos. A navegação visual não substitui autorização no servidor.
- **Aceite:** em 320, 390, 768 e 1280 px, localizar e abrir cada destino permitido por toque e teclado; identificar a página ativa; retornar ao conteúdo com o link “Ir para o conteúdo”; não haver rolagem horizontal da página causada pelo menu. Conferir também zoom de 200%.

## DS-02 — Hierarquia da visão geral (fase 1)

- **Atual:** “Preparar escala” e “Cadastrar ministro” usam o mesmo tratamento primário em regiões próximas, seguidas de várias ações secundárias.
- **Desejado:** uma ação primária por contexto visível. Na visão geral da coordenação, “Preparar escala” continua como chamada principal da página; “Cadastrar ministro” e as demais ações da seção “Gestão da coordenação” usam tratamento secundário. Na visão do ministro, “Minhas escalas” continua primária.
- **Aceite:** todos os destinos existentes continuam acessíveis e com os mesmos rótulos; a primeira ação perceptível em cada perfil é a definida acima; em 320 px, botões não se sobrepõem nem cortam texto.

## DS-03 — Ações da escala mensal (fase 1)

- **Atual:** seleção de mês, geração, aprovação, publicação, sincronização e downloads aparecem no mesmo painel, com pouca separação entre consulta e ações de estado.
- **Desejado:** organizar o painel em três grupos visuais: consulta de mês; ação de progressão do estado atual; ações auxiliares, como sincronizar e baixar arquivos. A ação principal por estado é: sem escala → “Gerar proposta”; rascunho/em revisão → “Validar e aprovar”; aprovada → “Publicar escala”; publicada → “Abrir nova revisão”. A ação “Gerar proposta” que ainda aparece no rascunho deve permanecer disponível como auxiliar, se já estiver disponível naquele estado. A organização não altera nenhuma condição de exibição ou valor enviado pelos formulários.
- **Aceite:** testar visualmente todos os estados (`DRAFT`, `IN_REVIEW`, `APPROVED`, `PUBLISHED`) e ausência de escala; cada ação mantém a mesma operação, disponibilidade e destino; os downloads continuam distinguindo o PDF geral do arquivo restrito com contatos; nenhum botão fica truncado em 320 px.

## DS-04 — Tokens e apresentação compartilhada (fase 2)

- Criar `docs/DESIGN_SYSTEM.md` com os tokens já usados em `globals.css` e registrar os novos tokens realmente necessários para superfícies de estado, espaçamento, raios e interação. Reutilizar valores existentes sempre que servirem; evitar criar uma segunda escala visual.
- Aplicar os tokens nos componentes compartilhados `.button`, `.secondary`, `.card`, `.panel`, `.notice`, `.error`, `.empty`, `.tag`, `.toolbar` e navegação. Manter os significados de verde, laranja e azul no calendário, sempre acompanhados dos rótulos existentes.
- **Aceite:** a mesma classe mantém aparência e estados equivalentes nas páginas; texto e controles atendem a contraste WCAG AA; foco visível permanece discernível; nenhuma informação depende só de cor.

## DS-05 — Densidade, painéis e tabelas (fase 2)

- Nas telas de escalas e relatórios, distinguir título, filtros, conteúdo e ações pelo espaçamento e alinhamento dos componentes existentes. Preservar a ordem lógica de leitura e o conteúdo das tabelas.
- **Aceite:** em 320 e 390 px, tabelas largas continuam utilizáveis com rolagem contida na região da tabela e indicação visual de que há conteúdo lateral; cabeçalhos e células não se sobrepõem; controles permanecem alcançáveis por teclado. Em 768 e 1280 px, títulos, filtros e ações se alinham sem espaços irregulares.

## DS-06 — Estados e interação (fase 3)

- Padronizar a apresentação de estados vazios, carregamento, erro, hover, foco e desabilitado nos componentes existentes. Um estado vazio só recebe chamada para ação quando o fluxo atual já oferece esse destino; não acrescentar rotas ou ações.
- **Aceite:** estados vazios de visão geral, listagens e escalas têm estrutura visual consistente; carregamento comunica progresso; erro mantém “Tentar novamente”; hover não é a única indicação de interatividade; `prefers-reduced-motion` evita movimento decorativo.

## Verificação e evidências

1. Registrar capturas antes/depois nos tamanhos 320, 390, 768 e 1280 px, com perfil de coordenação e de ministro, em Preview com dados fictícios.
2. Executar percurso por teclado: link de salto, menu, ação principal, filtros, tabelas e retorno ao conteúdo. Conferir foco e nomes acessíveis.
3. Revisar estados vazios, carregamento e erro, além dos quatro estados de escala. Confirmar que as ações mantêm destinos e operações originais.
4. Executar as verificações existentes do projeto apenas após a implementação. A homologação visual no navegador é indispensável; teste automatizado isolado não encerra esta especificação.

## Fora do escopo

Novas preferências de navegação, novos destinos, mudança de política de autorização, lógica de calendário/escala, conteúdo de PDF e modo escuro. A tarefa existente [#80 — Acessibilidade no celular](https://github.com/Trooper2123/mesce/issues/80) deve receber referência aos resultados de DS-01 e DS-05, sem duplicar o trabalho.
