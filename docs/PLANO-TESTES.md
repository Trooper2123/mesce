# Plano de testes do produto MESCE

Versão 2.0 · revisão de escopo em 12/11/2026.

## Objetivo e base

Validar a jornada completa da coordenação e do ministro, as permissões no servidor, a persistência e a preservação do histórico. Este plano amplia o roteiro do TestSprite, sem substituir ou reclassificar o resultado da execução original.

Base de código inspecionada: `dev`, commit `e4cbef58872163fec202a693d72aaf5e732fb3fb` (inclui catálogo de locais). Entregas consideradas: PRs #60–66 e #77, além do fluxo anterior de cadastros, CSV, impedimentos, geração e relatórios.

Evidência histórica mais recente desta sequência de desenvolvimento: suíte com **125 testes automatizados aprovados**, TypeScript, formatação e build. Esse número pertence à execução de implementação do catálogo, não significa que os casos manuais abaixo foram executados. A edição deste plano é documental; não houve nova execução funcional nem homologação de dispositivos nesta revisão.

### Estados de execução

- **A executar**: comportamento implementado; executar no commit exato do Preview que contém a entrega.
- **Bloqueado por implementação**: requisito planejado; não deve ser apresentado como falha de funcionalidade entregue.
- **Aprovado / Reprovado / Bloqueado por ambiente**: preencher somente após execução, com evidência.

Esta versão contém **67 cenários: 53 de produto implementado e 14 futuros bloqueados por implementação**.

Todos os casos da seção de produto implementado começam **A executar**. Nenhuma evidência antiga de unitário/SSR substitui sua homologação no navegador.

## Análise das lacunas do plano anterior

| Lacuna                                                           | Ajuste nesta revisão                                                                                      |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Roteiro concentrado na coordenação                               | Executar com coordenador, Ministro A, Ministro B e identidade sem acesso; testar URL e envio direto.      |
| Validação de cadastro confundida com sucesso de navegação        | Confirmar uma única mensagem de sucesso, persistência após recarga e valores preservados após erro.       |
| Calendário tratado como uma única visualização                   | Cobrir resumido, separado, completo, domingos, edição por card e filtros combinados.                      |
| Nomes iguais e horários coincidentes confundidos com duplicidade | Eventos distintos são permitidos; conflito obrigatório é do mesmo ministro designado em sobreposição.     |
| Séries e impedimentos tratados só como inclusão                  | Cobrir retirada lógica, exceções, remarcação, cancelamento, auditoria e histórico.                        |
| Locais tratados como texto livre                                 | Cobrir catálogo, IDs estáveis, várias preferências, renomeação/inativação e compatibilidade legada/CSV.   |
| Notificações internas confundidas com entrega externa            | Separar central implementada de push, assinatura pessoal e Nodemailer ainda planejados.                   |
| Contagem de testes usada como aceite fim a fim                   | Registrar camada, commit, papel e evidência de cada caso; não encerrar issue somente pelo total da suíte. |

## Ambiente, perfis e dados

1. Usar Preview com banco isolado e dados exclusivamente fictícios. Registrar URL, deployment, commit, navegador, versão e fuso. Não reutilizar segredo ou conexão de produção.
2. Confirmar `/acesso-dev`, senha de homologação já configurada e controles exclusivos de Preview. Não registrar a senha/cookies em evidências. A sessão antiga, anterior ao formato versionado, exige novo login.
3. Preparar coordenador C; Ministro A e Ministro B ativos e completos; P pendente; E ex-ministro; R revogado; identidade sem autorização para os testes Auth0. Os perfis A/B de Preview são sintéticos e distintos.
4. A coordenação deve criar/publicar os cenários: trocar para A/B não cria automaticamente eventos, impedimentos nem designações. Preserve as edições desses perfis entre acessos; não assumir reset automático.
5. Definir `T` como instante de referência de execução em America/Sao_Paulo. `M1` é o próximo mês; `M2`, o seguinte. Todas as inclusões/remarcações operacionais usam instantes futuros. Escolher domingos reais de M1/M2 e incluir uma virada de ano quando necessário.
6. Preparar três comunidades ativas L1/L2/L3; L4 inativa; um nome legado com variação apenas de caixa/espaços; uma abreviação diferente que não deve ser mesclada por suposição.
7. Preparar missas no mesmo domingo: 08:00 L1, 08:00 L2 e 19:00 L1; visita às 07:00 e outra às 10:00; dois eventos com o mesmo nome; durações com e sem sobreposição; série com três ocorrências, uma exceção; assistidos sintéticos com equipes de 1 e 3 ministros.
8. Publicar uma versão V1 e guardar seu PDF/hash. Criar revisão V2 para comparar mudanças. Usar CSVs sintéticos: válido, legado sem nome de preferência, atualização explícita e lote com linha inválida.
9. Para prazos do dia 25, usar teste automatizado com relógio controlado ou ambiente de teste apropriado. Não mudar relógio/variáveis de produção nem declarar o cenário aprovado por inspeção de código.

A sessão Preview valida autorização e fluxo aplicativo; não comprova login Auth0 real. O fluxo do provedor deve ter execução própria com identidades de teste autorizadas.

## Produto implementado — casos de homologação

P0 bloqueia aceite/release por integridade ou autorização. P1 cobre a operação principal. P2 cobre apresentação e compatibilidade complementar. A ordem por módulos não altera a prioridade.

### Autenticação e perfis

| ID      | Pri. / papel | Passos                                                                                                                                          | Resultado esperado                                                                                                                                   |
| ------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| AUTH-01 | P0 / C, A, B | Entrar por `/acesso-dev`, selecionar cada perfil e trocar pela faixa superior.                                                                  | Papel e menu correspondem à escolha; A/B têm IDs distintos e não recebem privilégios administrativos.                                                |
| AUTH-02 | P0 / A       | Abrir `/locais`, `/configuracao`, `/pre-cadastros` e tentar enviar uma ação administrativa diretamente.                                         | Negativa no servidor, sem gravação; esconder menu não é o único controle.                                                                            |
| AUTH-03 | P0 / A, B    | Abrir Meus dados, adulterar ID/papel/e-mail de acesso no envio e tentar editar B como A.                                                        | Só campos permitidos de A mudam; identidade, papel e cadastro alheio preservados.                                                                    |
| AUTH-04 | P0 / C, A    | C revoga/inativa A; A tenta ação já aberta; trocar novamente para A e depois B.                                                                 | A perde acesso; a troca não restaura cadastro/revogação; B continua independente.                                                                    |
| AUTH-05 | P0 / sessão  | Expirar/adulterar cookie, sair e voltar; verificar modo de teste com configuração Production em ambiente seguro.                                | Sessão inválida exige login; cookie de Preview não funciona em Production e o seletor não é disponibilizado lá.                                      |
| AUTH-06 | P0 / Auth0   | Iniciar login por origem alternativa de produção em ensaio autorizado; verificar origem canônica/callback; testar identidade fora da allowlist. | Transação mantém origem/cookie; state/PKCE preservados; usuário não autorizado não ganha acesso. Não usar sessão Preview como evidência deste teste. |
| AUTH-07 | P1 / C, A    | Alternar papel após editar o cadastro fictício e recarregar.                                                                                    | Dados não são resetados; sessão dura conforme configuração; perfil revogado pode voltar ao seletor sem ser promovido no fluxo comum.                 |

### Cadastros, nomes e importação

| ID     | Pri. / papel | Passos                                                                                                        | Resultado esperado                                                                                                                |
| ------ | ------------ | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| CAD-01 | P1 / C       | Salvar ministro incompleto como pendente; depois tentar concluir faltando obrigatório.                        | Pendente identificado; conclusão rejeitada com campos faltantes; pendente não entra na geração.                                   |
| CAD-02 | P1 / A       | Completar/editar perfil, informar nome de preferência e recarregar.                                           | Preferência salva; nome completo preservado no cadastro.                                                                          |
| CAD-03 | P1 / C       | Gerar escala/PDF com nome de preferência; limpar preferência e gerar nova revisão.                            | Nova escala usa preferência ou fallback para nome completo; V1 permanece intacta.                                                 |
| CAD-04 | P1 / C       | Criar assistidos com equipe 1 e 3; editar quantidade e salvar visita com formulário antigo.                   | Servidor usa cadastro atual do assistido ativo; não depende de nome “Altevita”; publicação antiga não é reescrita.                |
| CSV-01 | P1 / C       | Baixar exemplos de ministros/assistidos; importar UTF-8/BOM e separadores suportados, acentos e aspas.        | Modelos válidos; prévia e confirmação antes de gravar; valores/contatos preservados.                                              |
| CSV-02 | P0 / C       | Confirmar lote com erro, duplicidade ambígua ou prévia desatualizada; repetir importação válida.              | Erro sem gravação parcial; atualização explícita; não unir pessoas só por nome; repetição não duplica indevidamente.              |
| CSV-03 | P1 / C       | Importar arquivo legado sem nome de preferência/coluna de comunidade; depois mudar comunidade explicitamente. | Ausência de coluna preserva preferências atuais; mudança explícita segue compatibilidade documentada, sem reter IDs conflitantes. |
| CSV-04 | P0 / A       | Abrir/enviar importação por URL/ação direta.                                                                  | Acesso rejeitado no servidor; CSV não concede papel/login silenciosamente.                                                        |

### Agenda, visualizações e busca

| ID     | Pri. / papel | Passos                                                                                        | Resultado esperado                                                                                                              |
| ------ | ------------ | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| AGE-01 | P1 / C       | Cadastrar dois eventos com mesmo nome, horário e local.                                       | Dois UUIDs/registros independentes, sem sobrescrita; aviso de sobreposição, sem bloquear cadastro.                              |
| AGE-02 | P0 / C       | Designar o mesmo ministro em eventos sobrepostos e depois dois ministros distintos.           | Mesma pessoa bloqueada; coincidência entre eventos com pessoas distintas é permitida.                                           |
| AGE-03 | P1 / C       | Cadastrar fixo recorrente e extraordinário; comparar legenda/cor/rótulo e filtro.             | Classificação correta, distinguível sem depender só de cor; visita extraordinária.                                              |
| AGE-04 | P1 / C       | Selecionar várias datas em meses diferentes; remover uma seleção; salvar.                     | Um evento por data selecionada, mesmo horário/local, IDs distintos; sem multiplicação indevida pela repetição semanal.          |
| AGE-05 | P0 / C       | Tentar lote com uma data impossível/passada e visita fora de domingo, inclusive envio direto. | Validação integral antes da gravação; nenhum item parcial.                                                                      |
| AGE-06 | P1 / C       | Ver todas as visualizações com missas 08:00/19:00 e visita 07:00.                             | Em cada dia, celebrações por horário antes das visitas por horário; não seguir ordem de cadastramento.                          |
| AGE-07 | P1 / C       | Selecionar Resumido e clicar no card por mouse e teclado.                                     | Card mostra horário/nome, abre a ocorrência preenchida; mês, visualização e filtros do link preservados.                        |
| AGE-08 | P1 / C       | Selecionar Separado em mês com quatro e cinco domingos e fevereiro bissexto.                  | Calendário mensal de celebrações separado; assistidos só nas colunas de domingos corretos, sem outros dias; sem perder eventos. |
| AGE-09 | P1 / C       | Selecionar Completo; filtrar grupo e nome cadastrado; combinar busca e trocar mês/modo.       | Detalhes completos; seletor único por nome normalizado; filtros coerentes e contagem encontrados/total.                         |
| AGE-10 | P1 / C       | Buscar data ISO, brasileira, horário, local e combinação com nome, usando datas das fixtures. | Encontrar `AAAA-MM-DD` e `DD/MM/AAAA`; não limitar busca ao título; resultado negativo não inventa registro.                    |
| AGE-11 | P1 / C       | Forçar falha de validação e depois salvar corretamente; recarregar e conferir banco/lista.    | Dados do formulário preservados no erro; sucesso não aparece como erro de redirecionamento e há somente uma inclusão.           |

### Locais e múltiplas preferências — issue #9 / PR #77

| ID     | Pri. / papel | Passos                                                                                              | Resultado esperado                                                                                                            |
| ------ | ------------ | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| LOC-01 | P1 / C       | Cadastrar nome novo; repetir com caixa/espaços diferentes.                                          | Novo local recebe ID estável; duplicidade normalizada rejeitada.                                                              |
| LOC-02 | P0 / C       | Criar celebração pelo seletor; adulterar ID ou rótulo no envio.                                     | Nome vem do catálogo; ID desconhecido/inativo em nova escolha rejeitado. Visita não cadastra endereço privado no catálogo.    |
| LOC-03 | P1 / C, A    | Selecionar L1/L2 no cadastro administrativo e no próprio cadastro; recarregar.                      | As duas seleções persistem e são apresentadas corretamente.                                                                   |
| LOC-04 | P0 / C       | Configurar Somente L1/L2; gerar/revisar atribuições em L1, L2 e L3.                                 | Celebrações permitem qualquer local do conjunto; L3 bloqueado, mantendo outras restrições.                                    |
| LOC-05 | P1 / C       | Usar Prefere L1/L2 e Aceita todas em cenários comparáveis.                                          | Preferência atua no desempate existente; L3 continua permitido. Aceita todas não restringe. Não há ordem interna entre L1/L2. |
| LOC-06 | P0 / C       | Renomear L1, conferir cadastros/eventos correntes e V1/PDF guardado.                                | IDs/vínculos mantidos, rótulos correntes atualizados; snapshots/PDFs publicados intactos; agenda afetada exige revisão.       |
| LOC-07 | P1 / C       | Inativar L2; tentar nova escolha e editar registro antes associado.                                 | Não oferece novas escolhas de L2; vínculo anterior é preservado e identificado, sem exclusão do histórico.                    |
| LOC-08 | P1 / C       | Salvar configurações gerais após editar o catálogo; abrir nomes legados e CSV antigo.               | Catálogo não é apagado; correspondências exatas normalizadas recuperadas; abreviações não são mescladas por suposição.        |
| LOC-09 | P0 / A       | Tentar alterar catálogo por URL e envio direto; definir preferência de comunidades e testar visita. | Gestão do catálogo exclusiva da coordenação; preferência de comunidade não restringe endereço das visitas.                    |

### Impedimentos, ocorrências e séries — issues #20/#22

| ID     | Pri. / papel | Passos                                                                                                                    | Resultado esperado                                                                                                                                     |
| ------ | ------------ | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| IMP-01 | P1 / A       | Enviar dias avulsos, período inclusivo e celebração específica em lote; repetir.                                          | Campos condicionais; gravação coerente/idempotente; impedimento específico não bloqueia outro evento do mesmo dia.                                     |
| IMP-02 | P0 / A, C    | A retira impedimento próprio com justificativa; tentar outro titular, fora do prazo e após revogação; C registra exceção. | A só retira o próprio, no próximo mês até dia 25; servidor nega demais casos; C pode excepcionalizar; auditoria preservada.                            |
| IMP-03 | P0 / C, A    | Retirar impedimento já considerado em V1; gerar revisão; tentar reativar retirado pela edição.                            | Registro fica Retirado e deixa de bloquear novas escalas; V1 não muda; criar novo registro equivalente é possível, reativação por edição não.          |
| IMP-04 | P1 / A, C    | Concluir resposta mensal com e sem impedimentos; consultar consolidação.                                                  | Distinguir sem resposta de resposta sem impedimentos; prazo/papel respeitados.                                                                         |
| SER-01 | P0 / C       | Remarcar só a primeira ocorrência; conferir demais datas e vínculo do impedimento específico.                             | Mesmo UUID, ocorrência vira exceção, demais datas preservadas; aviso para revisar impedimento vinculado.                                               |
| SER-02 | P0 / C       | Alterar “esta e próximas”, ignorando uma ocorrência e preservando exceção individual/passado.                             | Deslocamento por mesmos dias e novo horário; só alvos permitidos alterados, exceções preservadas.                                                      |
| SER-03 | P0 / C       | Cancelar ocorrência/série com justificativa; depois gerar/sincronizar rascunho e consultar relatório.                     | Cancelamento lógico, novas escalas sem cancelados; designações saem ao sincronizar; relatório corrente exclui cancelados; publicação anterior intacta. |
| SER-04 | P0 / C       | Enviar remarcação para passado, lote inválido, exclusão alheia ou origem desatualizada.                                   | Operação rejeitada sem gravação parcial/sucesso falso.                                                                                                 |
| SER-05 | P0 / A, B    | Publicar designações distintas; remarcar/cancelar evento de A e depois evento compartilhado.                              | Central interna avisa titulares publicados afetados; B não recebe aviso exclusivo de A; lembrete do horário antigo suprimido e sem dados privados.     |

### Escalas, PDFs, relatórios e operação transversal

| ID     | Pri. / papel | Passos                                                                                                  | Resultado esperado                                                                                                                                                               |
| ------ | ------------ | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ESC-01 | P0 / C       | Gerar com equipe de visita 3, candidatos escassos, casal/preferências/impedimentos e limites opcionais. | Pessoas distintas respeitam regras; vagas não preenchidas explicadas; nenhum teto artificial quando ausente; sem promessa de ótimo global.                                       |
| ESC-02 | P0 / C       | Inserir/remover evento durante revisão, ajustar vagas e sincronizar.                                    | Agenda atualizada preserva alterações possíveis; diferenças/erros visíveis; aprovação exige validação atual.                                                                     |
| ESC-03 | P0 / C       | Aprovar, incluir impedimento/mudar agenda e tentar publicar; testar evento que atravessa mês.           | Revalidação impede publicação inválida e considera conflitos com publicações de mês vizinho.                                                                                     |
| PDF-01 | P0 / C, A, B | Baixar PDF geral e guia restrito como coordenador, responsável, outro ministro e identidade revogada.   | Autorizações por tipo de documento; geral sem endereço/título livre de visita; guia com contatos só para quem tem direito. PDF geral autorizado não é um feed pessoal de agenda. |
| PDF-02 | P1 / C       | Gerar mês extenso e conferir visualmente nome de preferência, tabelas e páginas.                        | A4 legível, cabeçalhos repetidos, sem corte/omissão/sobreposição; nome completo só como fallback.                                                                                |
| REL-01 | P1 / C       | Consultar mensal/12 meses, revisões e cancelamentos; trocar filtro de ministro.                         | Apenas publicação vigente, sem dupla contagem; modalidades separadas; histórico coerente com snapshots e cancelamento corrente documentado.                                      |
| NTF-01 | P0 / A, B    | Consultar central e abrir URL de aviso alheio; recarregar avisos.                                       | Autorização revalidada; destinatários corretos; IDs estáveis e sem duplicação por refresh. Não afirmar entrega externa.                                                          |
| OPS-01 | P0 / C, A    | Simular indisponibilidade/falha no meio de lote em ambiente de teste.                                   | Rollback; mensagem segura; sem dados/segredos em logs; nenhuma gravação parcial.                                                                                                 |
| UX-01  | P1 / C, A    | Navegar com teclado e tela estreita; usar seletores, cards, calendário e troca de papel.                | Rótulos e foco visíveis; ações alcançáveis; rolagem horizontal sinalizada quando necessária; cor não é único indicador; validação preserva campos.                               |

## Planejamento futuro — bloqueado por implementação

Estas funcionalidades foram mapeadas nas issues; não estão aprovadas nem disponíveis apenas porque existem neste plano. Usar habilitação por feature flag e ambiente de teste quando implementadas.

| ID      | Issue         | Cenário a executar depois da implementação                                                       | Resultado esperado                                                                                                                     |
| ------- | ------------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| CAL-01  | #72, #76      | A configura assinatura pessoal; adulterar titular na emissão e consulta do link.                 | Titular vem da sessão; credencial externa é própria, opaca e revogável, sem acesso global.                                             |
| CAL-02  | #76           | Consultar como A/B com evento exclusivo e compartilhado no mesmo eventId.                        | Cada um recebe apenas seus eventos publicados; colega comum não concede acesso às demais atividades nem ao feed alheio.                |
| CAL-03  | #67, #69, #76 | Assinar uma vez; publicar M1, repetir sem mudanças e publicar M2, inclusive dezembro→janeiro.    | Mesma assinatura recebe novas ocorrências; sem reinstalação, convite mensal nem confirmação de presença; histórico na janela definida. |
| CAL-04  | #68, #69      | Alterar ocorrência/remarcar entre meses e cancelar/remover ministro.                             | UID estável da ocorrência/titular, versão monotônica; atualização/cancelamento não duplica nem ressuscita evento.                      |
| CAL-05  | #71–73        | Escolher assinatura ou alternativa de e-mail; processar retries, timeout e publicação repetida.  | Menor número de mensagens; nenhuma duplicação push/e-mail por padrão; aceitação SMTP não equivale a entrega/agenda adicionada.         |
| CAL-06  | #68, #70      | Inspecionar ICS, link e prévia de visita; tentar download/reenvio alheio.                        | Sem identificação residencial/contatos de assistidos, lista de colegas, cookies ou credenciais; autorização no servidor.               |
| CAL-07  | #76           | Revogar/rotacionar link e acesso, testar cache cruzado e cliente externo após logout.            | Novas leituras bloqueadas conforme revogação; token não é cookie de login. Não prometer apagar cópia já baixada.                       |
| CAL-08  | #74           | Configurar assinatura no iPhone e acompanhar dois meses e cancelamento.                          | Atualização sem novo RSVP; atraso de consulta documentado; não declarar atualização imediata.                                          |
| CAL-09  | #75           | Configurar assinatura no Google Agenda web e visualizar no Android.                              | Mesma conta sincroniza a assinatura; instruções distinguem configuração web e app; testar clientes suportados separadamente.           |
| PUSH-01 | #32           | Instalar PWA no iPhone compatível e Android; pedir permissão após gesto; recusar/revogar.        | Adesão explícita, sem confundir com presença; sem suporte mantém central interna.                                                      |
| PUSH-02 | #32           | Publicar M1 com muitas atividades; repetir; publicar M2; alterar evento exclusivo/compartilhado. | Um resumo por ministro/dispositivo/competência e delta pertinente; sem alertas de terceiros nem convite por atividade para assinantes. |
| PUSH-03 | #32           | Receber com PWA fechado, offline/reconexão, Foco e economia de bateria.                          | Evidências por dispositivo/versão; TTL/retries e limites documentados, sem promessa de entrega/alarme exato.                           |
| PUSH-04 | #32           | Sair A, entrar B no mesmo aparelho; revogar A em outro aparelho.                                 | Endpoint antigo não vaza avisos ao novo usuário; acesso revalidado no clique; payload genérico.                                        |
| PUSH-05 | #32, #76      | Receber push e consultar agenda nativa.                                                          | Push avisa, não força refresh nem escrita na agenda; assinatura e permissão de notificação permanecem independentes.                   |

Recusa/aceite/contraproposta do calendário nunca altera a designação, impedimentos ou publicação MESCE. Configuração inicial de assinatura/conta e permissão do sistema operacional não são confirmação de presença.

## Cobertura automatizada e limites

| Área                             | Arquivos de referência                                                                                    | Ainda exige homologação                                                               |
| -------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Identidade, Preview e roteamento | `tests/mvp.test.ts`, `tests/preview-roles.test.ts`, `tests/auth-routing.test.ts`, `tests/config.test.ts`  | Login Auth0, cookies/origens reais, troca no navegador e links diretos.               |
| Cadastros/CSV/equipes            | `tests/feedback.test.ts`, `tests/assisted-csv.test.ts`, `tests/preferred-name-dates.test.ts`              | Upload, feedback, persistência após recarga e interação dos formulários.              |
| Agenda, séries e impedimentos    | `tests/event-agenda.test.ts`, `tests/operational-changes.test.ts`, `tests/testsprite-regressions.test.ts` | Cards, filtros, calendário, envio de ações e mensagens no Preview.                    |
| Catálogo/preferências            | `tests/locations.test.ts`                                                                                 | Autorização por URL/ação real, seleção múltipla, rename/inativação no fluxo completo. |
| Gerador, acesso e relatórios     | `tests/domain.test.ts`, `tests/privacy.test.ts`, `tests/reports.test.ts`                                  | Cenários publicados com A/B, negativa real e comparação com o PDF.                    |
| PDF e PostgreSQL                 | `tests/pdf-layout.test.ts`, `tests/store.test.ts` e testes PGlite dos módulos                             | Inspeção visual exportada, runtime PostgreSQL externo e comportamento em falha.       |
| Agenda externa/push              | Issues #32 e #67–76                                                                                       | Bloqueados por implementação; futuras provas em dispositivos reais e sandbox.         |

A suíte é executada com o comando do projeto. Neste runtime, o PGlite já apresentou falha nativa de V8/Wasm; a alternativa conhecida é:

```bash
node --no-wasm-tier-up --max-old-space-size=2048 --import tsx --test --test-concurrency=1 tests/*.test.ts
```

Executar também `npm run typecheck`, `npm run format:check` e `npm run build` quando houver mudança de código. Mudança exclusivamente documental exige formatação, integridade dos links e revisão de coerência; não precisa simular uma nova aprovação funcional.

## Ordem de execução e critérios de saída

1. Confirmar ambiente/commit e dados; executar AUTH-01–05 e casos negativos de acesso antes das operações administrativas.
2. Executar cadastro/CSV/locais e agenda; validar as duas visões reais, não apenas a do coordenador.
3. Executar impedimentos/séries e geração/revisão/aprovação/publicação; conferir persistência e auditoria.
4. Conferir notificações internas, relatórios, PDFs e experiência responsiva/teclado.
5. Executar Auth0 real em ensaio autorizado separado e comparar evidências com a sessão Preview.
6. Manter CAL/PUSH bloqueados até implementação; depois homologar iOS e Android separadamente.

Aceite da entrega: todos os P0 implementados executados e aprovados; P1 principais aprovados ou desvio explicitamente aceito; nenhuma pendência de autorização, gravação parcial, conflito de escala ou exposição de dados. Casos futuros ficam fora do aceite da entrega atual, mas bloqueiam a liberação da respectiva integração.

Para reexecutar o TestSprite, informar commit/URL exatos, papéis e fixtures, adaptar seletores aos rótulos atuais e guardar resultados brutos sanitizados. Não repetir a afirmação “17 testes” como se cobrisse o escopo novo; manter IDs históricos e mapear cada teste antigo aos novos casos.

## Registro de execução

Copiar uma linha por caso executado; não preencher resultado por antecipação.

| Caso        | Commit / deployment | Perfil / dados | Navegador / SO | Estado     | Resultado observado / evidência | Defeito / reteste |
| ----------- | ------------------- | -------------- | -------------- | ---------- | ------------------------------- | ----------------- |
| Ex.: AGE-10 | A preencher         | A preencher    | A preencher    | A executar | A preencher                     | A preencher       |

Evidências: passos reproduzíveis, horário/fuso, esperado versus observado, captura sanitizada e identificadores sintéticos. Nunca guardar senha, cookie, link secreto de assinatura, chave SMTP/VAPID, endereço residencial ou contato de assistido. Um bloqueio de ambiente deve registrar a causa e o caminho de reteste, sem ser marcado como aprovado.

## Referências do projeto

- [Roteiro histórico e correções TestSprite](TESTSPRITE-REGRESSOES.md)
- [Registro de evidências](VALIDACAO.md)
- [Perfis de homologação](HOMOLOGACAO-PERFIS.md)
- [Catálogo e preferências](LOCAIS-PREFERENCIAS.md)
- [Retirada e séries](RETIRADA-IMPEDIMENTOS-SERIES.md)
- [Agenda](EVENTOS-AGENDA.md), [nomes/datas](NOME-PREFERENCIA-DATAS.md), [CSV](IMPORTACAO-CSV.md)
- [PDF](PDF-ESCALA.md), [relatórios](RELATORIOS.md), [permissões](PERMISSOES.md)
- [Épico de agenda pessoal](https://github.com/Trooper2123/mesce/issues/67), [assinatura](https://github.com/Trooper2123/mesce/issues/76), [push](https://github.com/Trooper2123/mesce/issues/32)
