# Spec — menu da coordenação e novos recursos

Status: proposta funcional e técnica para implementação incremental

Branch de referência: `feat/adequacoes-ui-ux-40-mais`

Público principal: coordenação do MESCE, com atenção a pessoas 40+
Última atualização: 16 de novembro de 2026

## 1. Objetivo

Reorganizar a área da coordenação por tarefas, reduzir a sobreposição entre agenda e escalas e criar os destinos que ainda não existem: agendamento dedicado de visitas, histórico de ajustes em eventos, jornadas separadas de escala e cadastro estruturado de endereço dos locais, preparando o cálculo de proximidade.

A navegação do ministro permanece reduzida e não recebe funções administrativas.

## 2. Princípios

- Mostrar tarefas com nomes cotidianos, não nomes de entidades técnicas.
- Manter os grupos visíveis no desktop; somente o menu inteiro é recolhível no celular.
- Não usar links que apenas mudam o título e continuam levando a uma tarefa diferente.
- Agenda administra encontros; Escalas administra designações e versões publicadas.
- Preservar histórico e snapshots publicados. Nenhuma alteração retroativa silenciosa.
- Alvos principais com pelo menos 44 px de conforto, foco visível e indicação da página atual.
- Novas páginas devem funcionar com teclado, zoom de 200% e largura de 360 px.

## 3. Arquitetura de informação aprovada

| Grupo                   | Destino               | Finalidade                                                           |
| ----------------------- | --------------------- | -------------------------------------------------------------------- |
| Visão geral             | `/`                   | Pendências, próximos eventos e atalhos prioritários da coordenação.  |
| Meus dados              | `/meus-dados`         | Dados pessoais do coordenador autenticado.                           |
| Ministros               | `/ministros`          | Lista e gestão dos ministros.                                        |
| ↳ Pré-cadastros         | `/pre-cadastros`      | Autorizações e vínculos de acesso.                                   |
| ↳ Impedimentos          | `/impedimentos`       | Consulta e exceções administrativas.                                 |
| ↳ Respostas mensais     | `/respostas`          | Acompanhamento de recebidos, pendentes e respostas sem impedimentos. |
| Visitas dominicais      | `/visitas`            | Resumo das visitas agendadas no mês selecionado.                     |
| ↳ Assistidos            | `/assistidos`         | Lista de assistidos e acesso à gestão cadastral.                     |
| ↳ Agendar visita        | `/visitas/agendar`    | Formulário exclusivo para nova visita.                               |
| Locais e comunidades    | `/locais`             | Catálogo, endereço e situação dos locais.                            |
| Agenda                  | `/agenda`             | Resumo mensal de celebrações e visitas.                              |
| ↳ Gerenciar celebrações | `/agenda/celebracoes` | Celebrações recorrentes e extraordinárias.                           |
| ↳ Eventos com ajustes   | `/agenda/ajustes`     | Eventos remarcados, cancelados ou excluídos.                         |
| Escalas                 | `/escalas`            | Orientação e situação da escala do mês.                              |
| ↳ Escalas anteriores    | `/escalas/anteriores` | Histórico de versões finais e revisões.                              |
| ↳ Nova escala           | `/escalas/nova`       | Geração, revisão e publicação da escala do mês.                      |
| ↳ Baixar escalas        | `/escalas/downloads`  | Downloads permitidos por mês e versão.                               |
| Relatórios e histórico  | `/relatorios`         | Relatórios operacionais e histórico consolidado.                     |
| Lembretes e avisos      | `/notificacoes`       | Central de avisos da coordenação.                                    |
| Configurações           | `/configuracao`       | Políticas de geração e equilíbrio.                                   |

“Escalas” não aparece dentro de “Agenda”. A relação entre as áreas é apresentada por links contextuais, sem duplicação no menu.

## 4. Comportamento do menu

### 4.1 Desktop

- Exibir os grupos e seus filhos permanentemente.
- Destacar simultaneamente o item atual e seu grupo pai.
- Filhos usam recuo e tipografia, não somente cor, para comunicar hierarquia.
- O menu pode rolar independentemente do conteúdo.
- Não abrir ou fechar grupos automaticamente durante a navegação.

### 4.2 Celular

- Manter o botão global “Menu”.
- Ao abrir, mostrar a mesma hierarquia e todos os filhos.
- Fechar o menu depois de selecionar um destino.
- Preservar o foco visível e `aria-current="page"`.

### 4.3 Permissões

- A estrutura completa é exclusiva da coordenação.
- Ministro mantém apenas: Visão geral, Lembretes e avisos, Meus dados, Impedimentos, Respostas mensais e Minhas escalas.
- A proteção do servidor continua obrigatória; ocultar links não concede nem revoga acesso.

## 5. Recursos novos e alterados

### 5.1 Visão geral da agenda

Rota: `/agenda`.

Requisitos:

- Mostrar o mês por extenso e permitir mês anterior/próximo.
- Resumir quantidade de celebrações, visitas, cancelamentos e eventos ajustados.
- Oferecer visualização mensal e agenda em lista.
- Cada item mostra data, dia da semana, horário, nome, local e situação.
- Links contextuais levam para gestão de celebração, visita ou histórico do ajuste.
- Não editar eventos diretamente no resumo.

### 5.2 Gerenciar celebrações

Rota: `/agenda/celebracoes`.

- Separar a gestão de celebrações do agendamento de visitas.
- Filtros: mês, nome, recorrente, extraordinária, situação e busca textual.
- Cadastro de celebração não oferece campos específicos de assistidos ou visitas.
- Edição preserva recorrência, exceções, impedimentos relacionados e histórico.
- Cancelamentos e remarcações continuam exigindo confirmação e auditoria.

### 5.3 Agendar visita

Rota: `/visitas/agendar`.

- Formulário dedicado, sem opções de missa, adoração, casamento ou celebração.
- Selecionar um ou mais assistidos conforme as regras atuais de visita em grupo.
- Exibir endereço e contato somente a coordenadores autorizados.
- Informar data, local de atendimento, quantidade de ministros e observações.
- Ao salvar, redirecionar para `/visitas?month=AAAA-MM` e destacar a nova visita.
- Reutilizar validação, autorização, auditoria e persistência atuais; não duplicar regra de domínio.

### 5.4 Resumo de visitas dominicais

Rota: `/visitas`.

- Mostrar somente visitas do mês escolhido.
- Agrupar por data e informar assistido ou grupo, situação e quantidade necessária de ministros.
- Usar datas brasileiras e estado vazio orientativo.
- Ações: agendar, consultar detalhes e editar visita.
- Em celular, usar lista; não exigir tabela horizontal.

### 5.5 Eventos com ajustes

Rota: `/agenda/ajustes`.

Definição: evento que possui remarcação, cancelamento, exceção de série ou exclusão auditada.

- Período padrão: mês selecionado; permitir intervalo máximo de 12 meses.
- Filtros: tipo de ajuste, tipo de evento, situação e busca.
- Mostrar evento, valor anterior, valor atual, autor, data/hora e consequência para escalas.
- Exclusões aparecem a partir da auditoria mesmo quando o registro corrente não existe.
- Dados de assistidos não aparecem no relatório geral.
- Oferecer link para a versão corrente e para escalas que precisam de revisão.
- Paginar no servidor; padrão de 50 itens.

Fonte de dados inicial:

- `mesce_audit` para ações de remarcação, cancelamento, exclusão e normalização relevante.
- Registro corrente de evento para o estado atual.
- Snapshots de escalas somente para indicar impacto; nunca para reescrever histórico.

Se a auditoria antiga não contiver antes/depois suficiente, apresentar “Detalhes anteriores indisponíveis” em vez de inferir valores.

### 5.6 Jornada de escalas

#### Página principal — `/escalas`

- Explicar em linguagem curta: gerar proposta, revisar, aprovar, publicar e, se necessário, abrir revisão.
- Mostrar o mês atual, estado da última versão e próxima ação disponível.
- Não misturar downloads ou histórico extenso na primeira dobra.

#### Nova escala — `/escalas/nova`

- Selecionar mês e gerar proposta.
- Se já houver versão aprovada/publicada, a ação cria uma nova revisão; nunca substitui a anterior.
- Sincronizar mudanças da agenda antes da aprovação.
- Exibir pendências, conflitos e consequências antes de publicar.
- Excluir somente rascunhos permitidos pelas regras existentes.

#### Escalas anteriores — `/escalas/anteriores`

- Listar mês, revisão, situação, publicação e responsável.
- Permitir consulta das versões preservadas.
- Paginar e manter filtros na URL.

#### Downloads — `/escalas/downloads`

- Listar PDFs aprovados/publicados por mês e revisão.
- Separar PDF geral de material restrito com contatos.
- Material restrito exige revalidação de coordenação no servidor.
- Nome de arquivo identifica mês e revisão.

### 5.7 Locais e comunidades com endereço

Rota: `/locais`.

Adicionar ao tipo `Location`:

```ts
type LocationAddress = {
  postalCode: string;
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  latitude?: number;
  longitude?: number;
  geocodedAt?: string;
  geocodePrecision?: "ROOFTOP" | "STREET" | "POSTAL_CODE" | "CITY";
};
```

Requisitos:

- CEP aceita oito dígitos e é exibido como `00000-000`.
- Busca por CEP pode preencher logradouro, bairro, cidade e UF, mas todos os dados devem ser conferidos antes de salvar.
- Número permanece obrigatório; complemento é opcional.
- Falha do serviço de CEP não impede preenchimento manual.
- Não substituir automaticamente endereços existentes.
- Alterar endereço de um local não modifica snapshots ou PDFs publicados.
- Persistir endereço junto ao catálogo cifrado existente na primeira entrega.
- Auditar antes/depois sem registrar respostas brutas do provedor.

#### Consulta de CEP — BrasilAPI v2

Provedor aprovado: [BrasilAPI — CEP V2](https://brasilapi.com.br/docs#tag/CEP-V2).

- Consultar no servidor `GET https://brasilapi.com.br/api/cep/v2/{cep}` somente após ação explícita da pessoa usuária.
- Aceitar CEP com ou sem hífen na interface e enviar exatamente oito dígitos ao provedor.
- Validar o contrato recebido antes de preencher o formulário: `cep`, `state`, `city`, `neighborhood`, `street` e, quando disponíveis, `location.coordinates.latitude` e `location.coordinates.longitude`.
- Converter latitude e longitude, retornadas como texto, para números finitos dentro dos limites geográficos válidos.
- Aceitar `location.coordinates` ausente ou vazio como resposta válida sem coordenadas; o endereço ainda pode ser usado e a proximidade fica indisponível.
- Tratar `400` como CEP inválido, `404` como CEP não encontrado e `500` ou falha de rede como indisponibilidade temporária.
- Em qualquer falha ou resposta HTTP não prevista, manter os valores já digitados e permitir preenchimento manual.
- Não consultar a cada tecla, não varrer faixas de CEP e não executar novas tentativas automáticas em sequência.
- Reaproveitar consultas bem-sucedidas pelo CEP para reduzir chamadas, sem armazenar respostas brutas em logs.
- O preenchimento é uma sugestão: a pessoa deve conferir o endereço antes de salvar.
- Coordenadas da v2 vêm do OpenStreetMap e podem conter erros; registrar a precisão como `POSTAL_CODE` até confirmação mais precisa.

### 5.8 Proximidade

Objetivo: auxiliar a coordenação, nunca decidir automaticamente uma designação.

- Calcular distância aproximada entre endereço do ministro e local/assistido somente quando ambos tiverem coordenadas válidas.
- Exibir a distância como informação de apoio, com indicação “aproximada”.
- Não usar CEP isolado como distância exata.
- Não excluir automaticamente ministros por distância.
- A ordenação por proximidade deve ser opcional e preservar os demais critérios de equilíbrio.
- Coordenadas e endereços pessoais permanecem cifrados e restritos à coordenação.
- Usar inicialmente as coordenadas fornecidas pela BrasilAPI v2 para o CEP, deixando explícita a precisão postal e a possibilidade de correção.
- Rever termos de uso, retenção e base legal antes de enviar endereços completos a qualquer futuro provedor de geocodificação mais precisa.
- Quando não houver coordenadas, mostrar “Distância indisponível”; não estimar silenciosamente.

## 6. Modelo e persistência

### 6.1 Primeira entrega

- Evoluir `Location` dentro de `settings.locations`; não criar tabela apenas para reproduzir o armazenamento atual.
- Campos novos são opcionais durante a transição para manter registros existentes válidos.
- Validar e normalizar CEP/UF no servidor.
- Manter IDs atuais dos locais ao completar ou corrigir endereços.

### 6.2 Quando criar tabela própria

Migrar locais para tabela dedicada somente quando houver necessidade comprovada de consulta geoespacial, concorrência de edição ou indexação por coordenadas. Essa migração deverá ser aditiva, idempotente e preservar os IDs atuais.

### 6.3 Auditoria

Registrar no mínimo:

- criação e alteração de local;
- geocodificação e correção manual de coordenadas;
- criação, remarcação, cancelamento e exclusão de eventos;
- geração, aprovação, publicação, revisão e exclusão permitida de escala;
- downloads de materiais restritos.

Não registrar endereço completo ou contatos em texto aberto nos logs da aplicação.

## 7. Remoção da importação técnica anterior

- Remover da interface qualquer menção a “Importação técnica do sistema anterior” e “Importar cadastros legados”.
- Não incluir a operação no novo menu ou em Configurações.
- Ferramentas internas de migração podem permanecer no código operacional enquanto necessárias, sem rota ou botão acessível ao usuário.
- Importação CSV de ministros e assistidos é uma função cadastral distinta e não faz parte desta remoção.

## 8. Acessibilidade e conteúdo

- Títulos e menu usam capitalização consistente: “Visitas dominicais”, “Lembretes e avisos”.
- Meses por extenso; datas em `DD/MM/AAAA` ou com dia da semana.
- Controles de filtro têm rótulo visível e opção selecionada sem truncamento impeditivo.
- Resumos de erro recebem foco e preservam valores preenchidos.
- Estados vazios explicam o que aconteceu e a próxima ação disponível.
- Situação não pode depender apenas de cor.
- Respeitar `prefers-reduced-motion`.

## 9. Critérios de aceite

### Navegação

- `NAV-01`: coordenador localiza cada destino da seção 3 em até dois níveis.
- `NAV-02`: Ministro A não vê nem acessa destinos administrativos.
- `NAV-03`: item atual e grupo pai são identificáveis visualmente e por tecnologia assistiva.
- `NAV-04`: menu funciona com teclado, zoom de 200% e largura de 360 px.
- `NAV-05`: nenhum item “Escalas” aparece dentro de “Agenda”.

### Visitas e agenda

- `VIS-01`: “Agendar visita” abre formulário que contém somente campos de visita.
- `VIS-02`: nova visita aparece no resumo do mês após salvar.
- `AGE-01`: agenda mensal distingue celebração, visita, cancelamento e ajuste sem depender apenas de cor.
- `AGE-02`: relatório recupera remarcações, cancelamentos e exclusões auditadas.
- `AGE-03`: dados de assistidos não aparecem no relatório geral de ajustes.

### Escalas

- `ESC-01`: página principal explica o fluxo e oferece uma próxima ação inequívoca.
- `ESC-02`: gerar após publicação cria revisão, preservando versão anterior.
- `ESC-03`: histórico e downloads identificam mês, revisão e situação.
- `ESC-04`: download restrito revalida papel no servidor.

### Locais e proximidade

- `LOC-01`: CEP válido pode preencher endereço, que continua editável antes de salvar.
- `LOC-02`: indisponibilidade do serviço permite preenchimento manual.
- `LOC-03`: alteração preserva ID, eventos correntes vinculados e snapshots publicados.
- `LOC-04`: proximidade só aparece com coordenadas válidas e é marcada como aproximada.
- `LOC-05`: proximidade nunca exclui ou designa ministro automaticamente.

### Remoção técnica

- `LEG-01`: não há menção nem botão de importação do sistema anterior na interface.
- `LEG-02`: importações CSV cadastrais permanecem disponíveis e protegidas para coordenação.

## 10. Plano incremental

### Fase 1 — navegação e rotas

- Implementar menu hierárquico.
- Criar rotas reais e estados vazios dos novos destinos.
- Remover a importação técnica da interface.
- Manter regras atuais sem duplicação.

### Fase 2 — separar agenda e visitas

- Extrair formulário de visita para `/visitas/agendar`.
- Criar `/agenda` e `/agenda/celebracoes` reutilizando componentes existentes.
- Ajustar links, redirecionamentos e testes de autorização.

### Fase 3 — escalas por tarefa

- Separar orientação, nova escala, histórico e downloads.
- Preservar a função de domínio e as ações atuais como fonte única de regra.

### Fase 4 — histórico de ajustes

- Criar consulta paginada e segura sobre auditoria.
- Cobrir exclusões e impacto em escalas.

### Fase 5 — endereço e proximidade

- Evoluir o catálogo e formulários de local.
- Integrar a BrasilAPI v2 com validação de resposta e fallback manual.
- Homologar a precisão das coordenadas por CEP antes de habilitar ordenação por distância.

## 11. Validação

- Testes unitários de normalização de CEP, endereço, filtros e autorização.
- Testes de integração para preservação de ID, auditoria e snapshots.
- Testes de navegação para coordenador e Ministro A.
- Testes de jornada: criar visita, ajustar evento, gerar revisão e baixar versão.
- Verificação visual em 360 px, desktop e zoom de 200%.
- Avaliação moderada com representantes 40+ para localização das tarefas e compreensão dos nomes.

## 12. Fora de escopo desta spec

- Rotas públicas ou acesso sem autenticação.
- Geolocalização contínua do celular.
- Rastreamento de deslocamento ou cálculo de tempo em trânsito.
- Designação automática baseada somente em distância.
- Reescrita de escalas, PDFs ou snapshots já publicados.
- Remoção das ferramentas internas de migração do repositório.
