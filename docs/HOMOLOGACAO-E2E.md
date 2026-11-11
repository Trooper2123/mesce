# Dados fictícios para homologação

Carga manual: `node --import tsx scripts/seed-preview.ts`, exclusivamente com as variáveis do Preview e o host isolado validado no script. Não faz parte do build normal, migrations ou inicialização da aplicação.

Identificação: `MESCE-E2E-2026-v1`, nomes com prefixo TESTE, e-mails example.invalid, endereços fictícios e telefones vazios. Sem contas de login criadas e sem envio de e-mails.

Conjunto: 18 ministros (incluindo casal, preferências distintas, inativo e afastado), 3 assistidos (dois individuais e uma instituição com três ministros), 65 atividades dominicais em outubro, novembro e dezembro de 2026, três impedimentos e 54 respostas mensais. Outubro/novembro incluem publicação de exemplo somente quando o mês ainda não contém escala. Dezembro não recebe escala pré-gerada.

## Roteiro para o cliente

1. Entrar no Preview com acesso de coordenação.
2. Conferir os cadastros TESTE e as atividades de dezembro/2026.
3. Em Escalas, selecionar dezembro/2026, Gerar proposta e revisar as vagas, preferências e impedimentos.
4. Validar e aprovar; baixar o PDF da escala e o guia de visitas.
5. Publicar a escala.
6. Em Relatórios e histórico, selecionar dezembro/2026: conferir atividades, ministros, visitas, responsáveis e histórico detalhado.
7. Comparar consulta mensal e de 12 meses; filtrar um ministro no histórico. Rascunhos não devem somar nos relatórios; a publicação deve passar a aparecer.

Os registros anteriores são preservados. Se houver atividades pré-existentes em dezembro, elas também entram na geração e podem exigir ajuste de vagas/disponibilidade. O histórico de exemplo não atesta presença real.

## Operação

IDs determinísticos tornam a carga repetível sem sobrescrever registros já existentes ou alterações do cliente. Inserções e auditoria ocorrem na mesma transação; falhas revertem toda a carga. Reexecução ignora IDs existentes. A chave AES existente é usada somente no ambiente Vercel. Não trocar a chave nem inserir JSON sem cifragem diretamente na tabela.
