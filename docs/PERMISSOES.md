# Autonomia da coordenação

O coordenador é o operador principal do aplicativo. Seu acesso não depende de
possuir um cadastro de ministro vinculado. Quando também é ministro, acumula as
duas funções sem perder as operações administrativas.

| Informação ou operação                                               | Coordenador                                 | Ministro                                            |
| -------------------------------------------------------------------- | ------------------------------------------- | --------------------------------------------------- |
| Cadastrar e editar ministros, contatos, preferências e limite mensal | Todos os cadastros                          | Próprio cadastro, nos campos permitidos             |
| Ativar, inativar ou afastar ministros                                | Sim                                         | Não                                                 |
| Autorizar, revogar e restaurar acesso pela allowlist                 | Sim                                         | Não                                                 |
| Cadastrar e editar assistidos e contatos familiares                  | Sim                                         | Não                                                 |
| Registrar e corrigir impedimentos                                    | Qualquer ministro, inclusive fora do dia 25 | Somente os próprios, no prazo mensal                |
| Consolidar respostas mensais                                         | Qualquer ministro                           | Própria resposta, no prazo mensal                   |
| Cadastrar celebrações e visitas futuras                              | Sim                                         | Não                                                 |
| Gerar, ajustar, aprovar e publicar escalas                           | Sim                                         | Consulta das escalas publicadas às quais tem acesso |
| Configurar política de não resposta e parâmetros de geração          | Sim                                         | Não                                                 |
| Consultar o guia restrito de visitas                                 | Todas as visitas autorizadas à coordenação  | Somente visitas atribuídas ao próprio ministro      |

O coordenador pode cadastrar um ministro sem esperar seu login. O acesso pessoal
do ministro continua exigindo autorização do e-mail em Pré-cadastros e identidade
verificada pelo Auth0. Ao autorizar o mesmo e-mail, o sistema reutiliza o cadastro
existente.

Autonomia administrativa preserva as validações de integridade: UUIDs e vínculos
válidos, ausência de duplicidades, agendamentos futuros e revalidação da escala.
Mudanças são autorizadas no servidor e auditadas; versões já publicadas não são
reescritas silenciosamente. Ministros não podem atribuir papéis a si mesmos.
