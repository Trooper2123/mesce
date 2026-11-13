# Eventos fixos, extraordinários e horários coincidentes

## Cadastro

- Nomes podem ser repetidos. Eventos com o mesmo nome, data, horário e local também podem ser cadastrados como registros distintos.
- A coincidência de horário é um **aviso**, nunca impedimento para salvar o evento. O aviso considera o intervalo entre início e fim/duração, ignora cancelados e a própria ocorrência em edição.
- Na escala, permanece a restrição de designar a mesma pessoa a compromissos sobrepostos. Equipes diferentes podem servir em eventos simultâneos.
- Cadastro fixo recorrente: repetição semanal de 1 a 53 ocorrências; formulário inicia com 12 semanas, editáveis antes de salvar. Cada ocorrência possui ID próprio e a série compartilha um identificador interno.
- Cadastro extraordinário: uma ocorrência específica, para visitas, missas especiais e outros eventos avulsos. Uma missa também pode ser classificada explicitamente como extraordinária.
- Visitas são extraordinárias e mantêm a validação de domingo e a quantidade de ministros do assistido.
- Editar uma ocorrência não desloca as demais datas da série. Não há mudança automática retroativa em escalas aprovadas.

## Consulta

- Calendário e listagens usam data e horário, com desempate estável por nome/ID, sem depender da ordem de cadastro.
- Verde identifica fixos recorrentes; laranja identifica extraordinários; azul identifica visitas extraordinárias. Rótulos e legenda mantêm o significado sem depender de cor.
- O filtro de grupo mostra todos, fixos ou extraordinários. Mesmo filtrando um grupo, os avisos do calendário consideram os demais eventos da agenda.
- Avisos aparecem por evento no calendário e na listagem. Os seletores de celebração para impedimentos incluem data, horário, nome e local.
- Após salvar, a tela consulta o mês do encontro cadastrado, inclusive quando não é o mês atual.

## Compatibilidade e persistência

Os campos opcionais `eventClass` e `seriesId` ficam no payload cifrado existente, sem nova tabela ou migration. Registros antigos sem classificação são apresentados como fixos quando do tipo missa/adoração; os demais, como extraordinários. A coordenação pode ajustar a classificação ao editar. Isso não altera o conteúdo dos snapshots já aprovados.

O cadastro retorna confirmação estruturada depois da transação e da invalidação de cache, com navegação no cliente para o mês correto. Isso evita tratar o redirecionamento de sucesso como falha de salvamento. A autorização e a transação permanecem no servidor.

## Validação

Os testes cobrem nomes e horários repetidos, avisos sem rejeição, edição de ocorrência, série semanal, categorias, ordenação/filtragem do calendário, avisos entre grupos e persistência cifrada de dois eventos coincidentes no PostgreSQL descartável. A mesma pessoa continua inelegível para dois compromissos sobrepostos. Validação de navegador no Preview deve conferir o fluxo completo de envio da Server Action e apresentação dos avisos.
