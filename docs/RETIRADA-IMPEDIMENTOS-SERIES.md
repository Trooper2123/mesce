# Retirada de impedimentos e operações de séries — issues #20 e #22

## Impedimentos

Ao editar um impedimento ativo, a pessoa pode informar a justificativa e retirar o registro. A retirada é lógica: o mesmo UUID, abrangência e motivo original ficam armazenados, com responsável, instante e justificativa da retirada. A auditoria cifra o antes/depois. O impedimento retirado permanece visível como Retirado, deixa de bloquear o gerador e não pode ser reativado pela edição; é possível criar um novo registro equivalente.

O servidor revalida identidade e autorização dentro da transação. Ministro verificado e ativo só retira o próprio impedimento, do próximo mês e até o dia 25 no horário de Brasília. Fora do prazo, a coordenação pode excepcionalizar. A retirada não reescreve publicações nem designa automaticamente a pessoa.

## Ocorrências e séries

A coordenação pode remarcar ou cancelar uma ocorrência, ou a selecionada e as próximas da mesma série. Na remarcação em lote, todas as datas se deslocam pelo mesmo número de dias, com o novo horário informado. IDs e vínculos dos impedimentos específicos permanecem. A tela sinaliza a existência desses impedimentos para confirmação com os ministros e revisão da escala.

Ocorrências anteriores à selecionada, passadas, canceladas ou já marcadas como exceção individual ficam preservadas. Editar uma ocorrência isolada torna-a uma exceção, inclusive no formulário normal. Também é possível selecionar ocorrências a ignorar apenas naquela operação. Sem série, o formulário só permite alteração individual. A data/horário de origem são conferidos para rejeitar uma tela desatualizada.

O lote completo é planejado e validado antes de qualquer gravação. Datas impossíveis, eventos que passariam para o passado e visitas fora de domingo são rejeitados. A transação grava o lote e a auditoria cifrada com antes/depois, justificativa e escopo. Os cancelamentos são lógicos.

## Escalas, relatórios e comunicação

Snapshots e PDFs aprovados/publicados permanecem intactos. A agenda alterada exige sincronização/revisão e nova publicação pelos controles existentes. Eventos cancelados não entram nas novas escalas, são retirados das designações ao sincronizar o rascunho e não contam no relatório operacional corrente, mesmo quando presentes em uma publicação anterior. Isso não altera o arquivo PDF histórico.

A central autenticada apresenta aviso de cancelamento/remarcação aos ministros designados nas publicações vigentes e à coordenação. O aviso contém datas e horários, sem nomes, endereço ou contato de assistidos. O último aviso é mantido por evento; alterações anteriores continuam na auditoria. Lembretes do horário antigo são suprimidos. Não há envio de e-mail ou push, confirmação de leitura nem promessa de entrega fora da aplicação.

## Verificação e homologação

Testes cobrem titularidade, prazo/competência, retirada de dia/período/celebração, preservação do histórico, exceções, cancelamento individual/em série, datas inválidas, tela desatualizada, notificações restritas, relatórios e persistência com auditoria/rollback em PostgreSQL descartável. A homologação autenticada em Preview permanece necessária antes do aceite das issues.

Roteiro: retirar impedimento como ministro; repetir fora do prazo e com outro titular; confirmar exceção pela coordenação; remarcar uma ocorrência; executar série ignorando uma data; conferir impedimentos vinculados, avisos dos designados, relatório e PDF anterior; sincronizar a revisão e publicar a nova versão.
