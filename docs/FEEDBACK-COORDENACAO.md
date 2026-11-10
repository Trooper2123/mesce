# Ajustes de uso da coordenação — 10/11/2026

## Entrega

| Issue | Comportamento implementado                                                                                                                                                                                                   |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #48   | “Visita a assistidos” é uma atividade, separada da comunidade. “Eventos Externos” deixa de ser opção para novos cadastros; valores antigos aparecem identificados para revisão, sem conversão automática.                    |
| #50   | Preferências usam perguntas claras, explicações e resumo imediato. Comunidade exclusiva se aplica às celebrações, sem comparar com endereço de visita.                                                                       |
| #53   | Situação Ex-ministro é explícita e não apaga histórico. Bloqueia geração, nova inclusão manual e acesso de ministro; um papel independente de coordenador é preservado.                                                      |
| #49   | Campo eventKind separado de kind. Celebrações não exigem assistido; visitas exigem domingo e assistido ativo. Cadastro em outra aba + atualizar opções mantém o agendamento preenchido.                                      |
| #54   | Limite opcional e avançado, administrado pela coordenação. Novos cadastros usam null por padrão; limites/configurações já existentes são preservados até alteração explícita. A equidade continua sem teto.                  |
| #51   | Vários dias, períodos ou celebrações no mesmo lote. Validação antes das escritas e transação única. Repetição equivalente é deduplicada; períodos sobrepostos são preservados separadamente.                                 |
| #52   | Importação UTF-8, BOM opcional, vírgula/ponto e vírgula, aspas e quebra de linha. Modelo sintético, prévia, confirmação, atualização explícita por e-mail, vínculos conjugais e auditoria.                                   |
| #55   | Cadastro administrativo pode ser pendente, com dados faltantes visíveis. Conclusão exige nome, nascimento, telefone, início no ministério, endereço, bairro, cidade e UF no servidor. Pendentes não entram em novas escalas. |

## Cadastro e acesso

Pré-cadastro por e-mail continua independente da completude. O ministro conclui pelo
Auth0 e mantém somente seus próprios dados. Campos administrativos (situação,
limite e papéis) não são aceitos da edição pessoal. O coordenador mantém a gestão
integral e registra impedimentos fora do prazo mensal.

Registros antigos sem situação de completude não são desativados silenciosamente:
a coordenação recebe indicação dos campos faltantes ao editar e escolhe entre
pendente e concluído. Novas situações são opcionais no payload cifrado, compatíveis
com os registros existentes; não há nova migração DDL.

## Importação CSV

Apenas coordenação. Máximo 500 KB/500 ministros. Nome e e-mail obrigatórios para
identificação; dados pessoais restantes incompletos geram cadastro pendente. Datas
no formato AAAA-MM-DD; colunas reconhecidas são as do modelo. A prévia mostra o
mapeamento pelos cabeçalhos conhecidos e rejeita nomes desconhecidos, sem adivinhar
campos. Atualizar existentes exige seleção explícita; UUID, papel e colunas ausentes
são preservados. Cônjuges são resolvidos por e-mail após todas as linhas serem lidas,
sem associar pessoas pelo nome. Conflitos exigem revisão e cancelam a operação.

O arquivo não é salvo em armazenamento de uploads. A prévia não grava dados; a
confirmação recalcula o plano no servidor dentro da transação e rejeita se os
cadastros mudaram desde a prévia. Reimportar sem autorizar atualização ignora
existentes. Erros aparecem na tela, sem relatório CSV com fórmulas executáveis.

Autorizar login é uma escolha adicional: inclusão na allowlist não envia convite,
não cria identidade Auth0 e não restaura revogação. O vínculo reservado do
pré-cadastro é reutilizado. Alterações de dados são auditadas cifradas; logs de
processamento não recebem CSV bruto.

## Verificação e publicação

Testes de domínio, formulários e SQL, TypeScript e build local. Homologar no Preview
os formulários com JavaScript, preservação após erro, criação de assistido seguida
de atualização da lista, CSV com confirmação e impedimentos em lote. Login real
Auth0 continua dependendo da homologação com identidade autorizada.

A mudança de código não importa dados legados automaticamente, não troca chaves e
não promove produção. Cada issue permanece aberta até aceite funcional.
