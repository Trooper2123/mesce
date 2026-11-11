# Relatórios operacionais e histórico

Implementação das tasks #16 e #36 em /relatorios, acessível pelo menu Relatórios e histórico. A tela exige coordenação e revalida o papel dentro da transação antes de consultar e registrar reports:read na auditoria. Não há nova migração SQL.

## Consultas

- Mês isolado ou janela de 12 meses terminando no mês selecionado.
- Contagens por ministro, separadas entre celebrações e visitas, incluindo zero designações.
- Total, mínimo, máximo, média e diferença entre maior e menor contagem, sem pontuação, saldo ou frequência por assistido.
- Atividades das escalas publicadas, responsáveis, vagas e revisão.
- Visitas com responsáveis e contatos/endereço do snapshot publicado, restritos à coordenação.
- Histórico detalhado filtrável por ministro, preservando o nome registrado na publicação.

Somente a versão publicada vigente de cada competência entra no relatório. Revisões substituídas, rascunhos, aprovações não publicadas e publicações invalidadas por cancelamento posterior ficam fora. Eventos cancelados e referências a eventos inexistentes não somam participação; designações repetidas do mesmo ministro/evento contam uma única vez.

Métricas consideram todos os ministros cadastrados atualmente, incluindo inativos/ex-ministros/pendentes e sem designações, mais pessoas que existam somente nas publicações consultadas. A situação atual fica explícita. Média não mede disponibilidade ou esforço individual. O filtro de ministro altera apenas o histórico detalhado, mantendo o contexto geral.

As contagens representam designações, sem atestar presença ou atendimento realizado. Não há alteração de dados ou atualização retroativa de snapshots. Quando a publicação não contém snapshot do assistido, o relatório informa ausência de dados históricos; não preenche contatos usando o cadastro atual. Os nomes na tabela agregada são atuais, e o histórico detalhado usa os nomes publicados.

## Validação e limites

Testes cobrem passagem de ano, período inválido, versões substituídas e canceladas, separação das modalidades, deduplicação, zeros, registros somente históricos, contatos do snapshot, ausência de snapshot e referências órfãs.

Homologação autenticada da tela ainda necessária. Exportação dos relatórios e gráficos não fazem parte deste incremento; PDFs existentes permanecem nas telas de escalas. Não envia notificações nem promove produção.

As tasks #16 e #36 ficam abertas para homologação. Tasks de auditoria completa (#37), séries de eventos (#22), notificações (#30), restauração (#40) e outras continuam no backlog.
