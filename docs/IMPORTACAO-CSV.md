# Importação de ministros e assistidos

A coordenação encontra “Importar por CSV” e “Baixar CSV de exemplo” nas listagens de Ministros e Assistidos. Cada página de importação também oferece o exemplo da entidade. Os modelos são sintéticos, sem dados reais, em UTF-8 com BOM e separador ponto e vírgula. Substitua os exemplos antes de importar.

## Assistidos

Página: /assistidos/importar. Modelo: /api/assisted/template.

Cabeçalhos: id, nome, endereco, bairro, cidade, uf, cep, telefone_fixo, telefone_movel, familiar, telefone_familiar, quantidade_ministros, ativo, observacoes.

Nome é obrigatório. Para criar, deixe id vazio. Para atualizar, copie o ID exibido na listagem, informe-o no CSV e marque a opção de atualização. ID inexistente é rejeitado. O importador não transforma um ID desconhecido em novo cadastro.

Quantidade de ministros é inteiro de 1 a 100. Nova pessoa sem essa coluna recebe 1; um cadastro como Altevita pode informar 3 ou mais. Ativo aceita SIM, NAO ou NÃO. Campos opcionais ausentes são preservados em atualizações; uma célula vazia limpa texto, mas quantidade e ativo vazios são inválidos. Mantenha telefones e CEP como texto para preservar zeros.

Registros com nome/endereço normalizados repetidos são rejeitados no arquivo. Sem ID, um registro semelhante ao já existente é ignorado na criação e exige ID explícito no modo de atualização; nunca é sobrescrito por semelhança. Homônimos podem ser tratados manualmente. O identificador e as operações aparecem na prévia, junto à quantidade de ministros.

## Ministros

Página: /ministros/importar. Modelo: /api/ministers/template.

O modelo existente foi preservado e o download ficou acessível também pela listagem. Identificação por e-mail e atualização explícita, preferências, vínculo conjugal e eventual autorização de acesso seguem o fluxo já implementado. Assistidos não possuem opção de allowlist.

## Segurança e operação

Até 500 KB e 500 registros, separador vírgula ou ponto e vírgula, aspas e quebras de linha suportadas. Toda validação ocorre antes das gravações. A prévia não grava cadastros; a confirmação refaz o plano dentro de transação e rejeita cadastros modificados desde a prévia. Papel de coordenação é revalidado no servidor na prévia e na confirmação de ambas as entidades.

Auditoria registra prévia por contagem e alterações antes/depois cifradas. Não grava arquivo bruto ou contatos em logs. A importação é atômica; falha reverte o lote. Importar ou atualizar assistidos não altera visitas/publicações anteriores nem concede acesso ao app. Não há nova DDL.

## Validação

60 testes passaram na branch baseada em dev: seis novos testes cobrem os dois exemplos, acentos/aspas/separadores, contatos/zeros, quantidade, IDs, atualização parcial, duplicidades, limites, arquivo inválido, prévia desatualizada por hash e imutabilidade do cadastro durante planejamento. TypeScript, formatação e build devem passar antes da publicação. Homologação autenticada continua pendente; testes do plano não equivalem a teste de ponta a ponta das Server Actions.

Refs #58 e #52.
