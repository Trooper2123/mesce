# Catálogo de locais e múltiplas preferências — issue #9

A coordenação administra `/locais`: cadastrar, renomear e inativar comunidades. Celebrações usam um seletor de catálogo; o servidor obtém o nome pelo ID e rejeita IDs inexistentes/inativos em novas escolhas. Visitas mantêm seu local restrito separado do catálogo público.

Ministros e coordenação podem selecionar várias comunidades nas preferências:

- Aceita todas: não restringe nem prioriza comunidades.
- Prefere as selecionadas: usa o conjunto como critério de desempate já existente, mantendo a distribuição e os demais critérios do gerador; aceita locais diferentes.
- Somente as selecionadas: limita celebrações ao conjunto, com igualdade por ID.

O conjunto não tem ordem de prioridade interna. A preferência de atividade continua independente: comunidades não restringem endereços de visitas. Impedimentos, capacidade, situações cadastrais, casais e conflitos de horário continuam sendo aplicados.

## Compatibilidade

O catálogo é persistido cifrado nas configurações existentes, sem nova migration. As configurações gerais preservam o catálogo ao serem salvas. Eventos usam `locationId`; ministros usam `locationIds`; o texto `location` permanece como rótulo compatível e para snapshots.

Os três nomes existentes são fornecidos inicialmente. Nomes antigos de ministros e celebrações são recuperados com IDs determinísticos. Somente caixa e espaços são normalizados: apelidos, abreviações e comunidades diferentes não são unidos por suposição. Endereços de visitas e rótulos concatenados de múltiplas preferências não alimentam o catálogo.

Ao salvar o catálogo, os registros correntes legados recebem vínculos por correspondência exata normalizada. Uma renomeação mantém os IDs e atualiza rótulos correntes; os snapshots/PDFs aprovados e publicados não são reescritos. A agenda alterada deve passar pela sincronização/revisão já existente. A normalização é transacional e auditada, incluindo antes/depois dos registros afetados.

Inativar impede novas escolhas, mas preserva vínculos existentes, inclusive para edição de registros já associados. Não há exclusão destrutiva. Registros legados continuam sendo considerados pelo motor com comparação normalizada quando ainda não possuem IDs.

CSV continua aceitando a coluna antiga de comunidade. Arquivos que omitem essa coluna preservam seleções múltiplas existentes. Quando o CSV muda explicitamente a comunidade, o vínculo anterior é limpo e o nome legado fica disponível para revisão no catálogo. Seleção múltipla por CSV não faz parte desta entrega.

## Validação

Testes incluem catálogo/IDs legados, duplicidade, alteração desatualizada, conjuntos exclusivos/preferenciais, inativos, local forjado, separação de visitas, UI dos seletores e persistência PostgreSQL cifrada de renomeação com publicação anterior intacta. Typecheck, formatação e build devem passar.

Roteiro de homologação: cadastrar comunidade como coordenador; selecionar duas comunidades em Meus dados e no cadastro administrativo; criar missa pelo catálogo; gerar escala com opção exclusiva e preferencial; renomear/inativar comunidade; conferir vínculos correntes, nova escolha bloqueada e PDF publicado anterior. Confirmar que ministro não acessa a gestão do catálogo por URL ou envio direto. Homologação autenticada pendente antes do aceite da issue.
