# Nome de preferência e múltiplas datas

O cadastro do ministro permite informar um nome de preferência opcional, com até 80 caracteres. O nome completo continua no cadastro. Novas escalas e seus PDFs usam o nome de preferência; quando vazio, usam o nome completo. A aprovação atualiza os nomes do rascunho. Escalas já publicadas preservam seus nomes históricos.

O CSV de ministros aceita a coluna opcional `nome_preferencia`. Importações antigas sem essa coluna preservam o valor existente.

No novo cadastro de celebração, escolha uma data com repetição semanal ou selecione várias datas no calendário. É possível navegar entre meses, revisar e remover seleções, com até 53 datas por cadastro. Todas recebem o mesmo horário, local e demais dados do formulário. O lote inteiro é validado antes da gravação; uma data inválida impede o salvamento de todo o lote. A edição continua sendo por ocorrência.

Não é necessária migração: os dados permanecem no armazenamento JSON existente.

Validação: 90 testes aprovados, incluindo persistência com PostgreSQL/PGlite, geração do PDF com nome de preferência, importação CSV e gravação de múltiplas datas; typecheck, formatação e build concluídos.
