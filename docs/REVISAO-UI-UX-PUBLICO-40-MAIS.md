# Revisão de UI e UX — público 40+

Data: 16/11/2026

Produto: MESCE — Gestão pastoral

Perfis: Coordenação e Ministro de teste A
Status: ajustes pontuais implementados na branch `feat/adequacoes-ui-ux-40-mais`; reorganização estrutural do menu permanece pendente de protótipo e validação com usuários.

## Implementação realizada

- Obstáculos P1: recuperação amigável em notificações, ação de impedimento antes do calendário, destino compatível com o perfil e agenda em lista no celular.
- Compreensão P2: datas brasileiras, filtros mais largos, linguagem cotidiana, identificação completa das celebrações, estado vazio orientativo e indisponibilidade contextualizada.
- Acessibilidade: foco no resumo de erros, indicação uniforme de campos obrigatórios/opcionais, alvos existentes preservados e paginação de listas extensas.
- Não implementado: UX-06, pois a reorganização do menu depende da validação prévia indicada neste documento. A validação presencial com participantes 40+ e em hardware real continua necessária.

## Síntese

A aplicação possui uma base favorável à leitura e ao uso: texto principal de 18 px, campos de 17 px, botões com altura mínima de 48 px, ícones acompanhados de rótulos e foco visível definidos no código. Na visão do ministro, o menu com cinco opções reduz o esforço de navegação.

Os principais obstáculos são a dificuldade de encontrar a ação de informar impedimentos, o excesso de informação nos calendários e listagens e a falta de orientações claras em situações de erro ou ausência de conteúdo. As configurações de notificações apresentaram uma falha de carregamento reproduzida no perfil Ministro A.

Para a coordenação, a prioridade é organizar os destinos do menu e tornar explícito o período exibido nas listagens. Para o ministro, a prioridade é permitir registrar ausências rapidamente e entender quando seus compromissos estarão disponíveis.

O público 40+ deve ser considerado em sua diversidade de visão, mobilidade e familiaridade digital. As propostas buscam reduzir esforço e incerteza, sem presumir baixa habilidade tecnológica pela idade.

## Escopo e evidências

- Homologação: inspeção em navegador desktop da tela de celebrações no perfil de coordenação.
- Ministro A: inspeção de Visão geral, Impedimentos, formulário de impedimento, Meus dados, Minhas escalas, Central de notificações, Agenda pessoal e Configurar notificações.
- Código: leitura da navegação, estilos, calendário, campos, tratamento de formulários e página de escalas pessoais.
- A falha de Configurar notificações persistiu após acionar Tentar novamente. A causa técnica não foi investigada nesta revisão.
- O Ministro A não possuía compromissos publicados. Não foram validados detalhes de compromissos, PDFs ou visitas atribuídas.
- Não foram realizadas gravações de dados, testes em celular real, avaliação completa por teclado, leitor de tela ou testes com participantes.
- A versão local e a homologação apresentam diferenças de texto. Achados de código precisam ser conferidos na versão escolhida para implementação.

As observações abaixo distinguem evidência de tela, evidência de código e recomendações ainda dependentes de validação. Esta revisão não certifica conformidade de acessibilidade.

## Modificações propostas

### P1 — Corrigir obstáculos nas tarefas principais

| ID    | Achado e evidência                                                                                                                                                            | Modificação proposta                                                                                                                                        | Critério de aceite                                                                                                                                                    |
|-------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| UX-01 | Configurar notificações falha no Ministro A, inclusive após nova tentativa. A mensagem orienta verificar variáveis de ambiente e migração do banco. Observado na homologação. | Investigar e corrigir a falha. Substituir a orientação técnica por instrução adequada ao ministro, mantendo detalhes de diagnóstico nos registros internos. | A página carrega para o Ministro A. Em falha simulada, oferece nova tentativa e orientação para procurar a coordenação, sem exigir conhecimento de infraestrutura.    |
| UX-02 | Informar impedimento aparece após todo o calendário mensal. Observado no Ministro A.                                                                                          | Posicionar uma ação de informar impedimento no início da página, antes do calendário, com acesso direto ao formulário.                                      | Ao abrir Impedimentos, o usuário encontra a ação principal antes do calendário e chega ao formulário com um acionamento.                                              |
| UX-03 | Eventos do calendário de impedimentos são links identificados como Editar e apontam à área de celebrações. Observado no Ministro A; não foi comprovada permissão de edição.   | Adequar a ação ao perfil: consultar detalhes ou informar ausência naquela celebração. Revisar destino e nome acessível do link.                             | O ministro encontra uma ação compatível com sua tarefa e suas permissões. Nenhum link promete editar um evento quando essa operação não está disponível ao perfil.    |
| UX-04 | Calendário tem largura mínima de 850 px no código, criando dependência de rolagem horizontal em espaços menores.                                                              | Oferecer agenda em lista por dia como alternativa ao calendário, especialmente em telas estreitas. Manter a visualização mensal para consulta panorâmica.   | A lista apresenta data, dia da semana, horário, nome e local sem rolagem horizontal em largura de 360 px. Alternar a visualização preserva o período e os filtros.    |
| UX-05 | Calendário de dezembro acompanhado por listagem de 286 registros de vários meses. Observado na coordenação.                                                                   | Alinhar o período da lista ao calendário ou tornar explícita a independência entre eles. Acrescentar paginação à listagem extensa.                          | A tela identifica o período de cada conjunto de dados. O usuário consegue consultar somente o mês escolhido e navegar por resultados em páginas, preservando filtros. |




### P2 — Melhorar compreensão, orientação e conferência

| ID    | Achado e evidência                                                                                                                    | Modificação proposta                                                                                                                                           | Critério de aceite                                                                                                                                                        |
|-------|---------------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| UX-06 | Menu da coordenação tem 14 destinos, com sobreposição de nomes entre celebrações, visitas e escalas. Observado na tela e no código.   | Estudar agrupamento por tarefas, separando organização da agenda, preparação de escalas, cadastros e recursos pessoais. Preservar o menu reduzido do ministro. | Os destinos têm finalidade distinguível e indicação de página atual. Validar a localização de tarefas com representantes da coordenação antes de adotar a estrutura.      |
| UX-07 | Datas em formato técnico, como 2026-12 e 2026-10-04. Observado na coordenação e identificado no código de escalas pessoais.           | Usar mês por extenso nos títulos e formato brasileiro nas datas. Incluir dia da semana onde ajuda a conferir compromissos.                                     | Títulos mostram, por exemplo, Dezembro de 2026. Datas de exibição usam 04/12/2026 ou sexta-feira, 4 de dezembro. Preservar formatos técnicos apenas nos valores internos. |
| UX-08 | Opções selecionadas dos filtros ficam truncadas. Observado na coordenação.                                                            | Ajustar distribuição dos filtros ou reduzir rótulos sem perder significado.                                                                                    | A opção ativa é compreensível em desktop e em telas estreitas, sem depender de passar o mouse.                                                                            |
| UX-09 | Formulário de impedimentos usa termos como deduplicados, lote inteiro e Abrangência. Observado no Ministro A.                         | Reescrever instruções em linguagem cotidiana, explicando somente o necessário para concluir a tarefa.                                                          | A pessoa entende como informar dia, período ou celebração sem precisar interpretar termos técnicos.                                                                       |
| UX-10 | Impedimento por celebração mostra nome do evento sem data e horário na linha de consulta. Observado no Ministro A.                    | Acrescentar data, horário e local à identificação do impedimento.                                                                                              | Eventos com nomes iguais podem ser distinguidos sem abrir a edição.                                                                                                       |
| UX-11 | Minhas escalas mostra Você ainda não possui designações publicadas, sem próximo passo. Observado no Ministro A.                       | Explicar que os compromissos aparecerão após publicação pela coordenação. Distinguir ausência de compromisso de erro de carregamento.                          | O estado vazio informa o que está acontecendo e o que o usuário pode fazer, sem sugerir que uma falha ocorreu.                                                            |
| UX-12 | Configurar agenda pessoal está disponível, mas a assinatura não está habilitada neste ambiente. Observado no Ministro A.              | Informar a indisponibilidade antes do acesso ou contextualizá-la claramente na página de destino.                                                              | O usuário entende que a indisponibilidade é do ambiente e não um erro que possa resolver preenchendo seus dados.                                                          |
| UX-13 | Erros de ActionForm aparecem antes dos campos, sem direcionamento explícito de foco ou associação aos campos. Identificado no código. | Direcionar foco ao resumo de erros e associar mensagens aos campos pertinentes, preservando os valores preenchidos.                                            | Após erro em formulário longo, a mensagem é percebida e permite localizar os campos a corrigir por teclado. Valores preenchidos permanecem disponíveis.                   |
| UX-14 | Componente de campos não apresenta indicação visual consistente de obrigatoriedade. Identificado no código.                           | Indicar campos obrigatórios e opcionais de maneira uniforme e explicar a convenção antes do preenchimento.                                                     | A obrigatoriedade é compreensível visualmente e por tecnologia assistiva antes de enviar o formulário.                                                                    |

### P3 — Refinar e validar o conjunto

- Verificar a largura e o espaçamento dos dias no seletor de múltiplas datas. A altura de 48 px definida no código não garante largura confortável em celular.
- Medir contraste de texto, estados selecionados, bordas e foco na versão final; evitar declarar aprovação apenas pela aparência da paleta.
- Verificar zoom de 200%, navegação por teclado e conteúdo longo nas páginas prioritárias.
- Avaliar a hierarquia entre consultar compromissos e configurar integrações. Em Minhas escalas, configurações não devem competir com a informação principal.
- Separar o impacto do grande aviso de homologação da experiência real de produção. O aviso ocupa espaço relevante nas capturas, mas é específico do ambiente de testes.

## Exemplos de redação para avaliação

| Texto atual                                                                      | Alternativa proposta                                                                                |
|----------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------|
| Abrangência                                                                      | Quando você não poderá servir?                                                                      |
| Dias repetidos são deduplicados                                                  | Datas repetidas contam uma vez.                                                                     |
| O lote inteiro será validado antes de salvar                                     | Se algum item precisar de correção, nenhum impedimento desta lista será salvo.                      |
| Você ainda não possui designações publicadas                                     | Seus compromissos aparecerão aqui quando a coordenação publicar sua escala.                         |
| Informe ausências até o dia 25 do mês anterior                                   | Para a escala de dezembro, informe os dias em que não poderá servir até 25 de novembro.             |
| Verifique a conexão, as variáveis de ambiente e a aplicação da migração do banco | Não foi possível carregar suas configurações. Tente novamente. Se continuar, procure a coordenação. |

O exemplo de prazo deve ser calculado a partir do mês da escala, respeitando a regra vigente. As redações são propostas, não alterações aprovadas.

## Alternativas de implementação

### Alternativa A — Ajustes pontuais

Corrigir notificações, antecipar a ação de impedimentos, adequar os links ao perfil, revisar datas, textos, filtros e estados vazios.

Vantagem: menor mudança para usuários atuais e entrega mais rápida. Limitação: mantém boa parte da estrutura existente e da densidade do calendário.

### Alternativa B — Organização por tarefas

Incluir os ajustes pontuais, acrescentar agenda em lista e reorganizar a navegação da coordenação.

Vantagem: maior potencial de reduzir esforço de consulta e descoberta. Limitação: exige protótipo e validação da nova organização com usuários.

Recomendação: começar pelos obstáculos P1, prototipar a agenda em lista e avaliar a reorganização do menu antes de implementá-la. Cores, fontes, tamanhos e organização final permanecem sujeitos à aprovação da direção de design, conforme a skill utilizada.

## Plano de validação

1. Ministro A: localizar a ação de informar impedimento, preencher dia, período e celebração e conferir o resumo antes de salvar em ambiente de testes.
2. Ministro A: confirmar o estado sem compromissos e, com uma escala fictícia publicada, consultar data, horário, local e documentos permitidos.
3. Ministro A: abrir e configurar notificações em cenário normal; conferir comportamento em falha de carregamento.
4. Coordenação: selecionar um mês, localizar um evento e confirmar quais registros são afetados pelo filtro.
5. Ambos: repetir as tarefas em celular e desktop, com teclado e zoom de 200%; verificar foco, alvos de toque e ausência de cortes de conteúdo.
6. Participantes 40+ com diferentes níveis de familiaridade digital: observar conclusão sem ajuda, erros, hesitações e compreensão das mensagens. Comparar os resultados antes e depois das mudanças.

Meta de conforto proposta: alvos principais de 44–48 px, com espaçamento adequado. A WCAG 2.2 AA define um mínimo de 24 × 24 px para alvos, com exceções; 44 × 44 px corresponde ao critério aprimorado. Não tratar a meta de conforto como requisito normativo AA.

## Referências e pontos de implementação

- [WCAG 2.2 — tamanho mínimo de alvos](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)
- [WCAG 2.2 — contraste mínimo](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)
- Navegação: `src/components/main-navigation.tsx`.
- Calendário e seleção de datas: `src/components/calendar.tsx` e `src/components/multi-date-picker.tsx`.
- Formulários: `src/components/action-form.tsx`, `src/components/fields.tsx` e `src/components/absence-fields.tsx`.
- Estilos: `src/app/globals.css`.
- Área pessoal: `src/app/page.tsx`, `src/app/meus-dados/page.tsx` e `src/app/minhas-escalas/`.

As credenciais de homologação não integram este documento.
