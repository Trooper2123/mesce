# Assinatura pessoal de agenda

## Escopo desta entrega

O ministro ativo pode ativar uma assinatura ICS pessoal em **Minhas escalas →
Configurar agenda pessoal**. O feed contém somente ocorrências publicadas em que
o titular está designado, mais cancelamentos necessários para atualizar a
agenda. Não inclui RSVP, colegas, justificativas, PDFs ou dados de assistidos.
Visitas aparecem como “Visita a assistido”, sem local ou endereço. O conteúdo
usa horários UTC calculados a partir do fuso `America/Sao_Paulo`; o calendário
do aparelho os converte para a hora local.

A assinatura é somente leitura. Atualizações dependem da frequência de consulta
do aplicativo de calendário; o MESCE não controla nem promete atualização
imediata. O feed conserva até 30 dias de histórico e inclui todas as
competências futuras já publicadas, sem substituir os meses anteriores.

## Configuração e habilitação

1. Aplicar a migração aditiva `004_calendar_feeds.sql` pelo processo normal de
   migrações.
2. Revisar a política de logs do ambiente, inclusive logs de acesso da
   plataforma, para assegurar que o caminho com credencial não seja retido ou
   compartilhado.
3. Definir `MESCE_CALENDAR_FEEDS_ENABLED=true` somente no ambiente escolhido
   para homologação. O padrão é desabilitado; apagar/desabilitar a variável
   bloqueia imediatamente as leituras e a gestão dos feeds.
4. Validar a ativação, rotação, revogação, atualização entre competências,
   cancelamento e privacidade. Homologar iOS e Android separadamente antes de
   habilitar em produção.

O recurso não envia e-mails ou push. Nodemailer e Web Push continuam separados
e dependem das issues #71–75 e #32, respectivamente.

## Credencial e privacidade

O endereço contém um segredo aleatório de 256 bits e funciona como credencial
bearer. O banco guarda apenas seu hash SHA-256. O segredo é mostrado uma única
vez; gerar outro revoga o anterior. A revogação também ocorre se o vínculo
autorizado da conta deixar de estar ativo ou se o cadastro do ministro for
desativado/ex-ministro. Se o mesmo Auth0 subject tentar autenticar com outro
e-mail verificado, o feed anterior é revogado e exige nova ativação após a
coordenação reconciliar o cadastro.

A resposta usa `no-store`, desabilita cache de CDN, impede indexação e envia
`Referrer-Policy: no-referrer`. A aplicação não registra o segredo. A rota
precisa continuar fora de logs da plataforma que registrem o caminho completo;
se não for possível garantir essa configuração, não habilite o recurso nesse
ambiente. O link pode ser compartilhado por quem o possui e deve ser tratado
como senha.

## Limites e próximos passos

Esta entrega inicia a issue #67 pela assinatura pessoal priorizada na issue
#76. Ainda requer homologação em dispositivos reais. Não confirma integração
comportamental de cada cliente de calendário.

O transporte Nodemailer/SMTP, outbox durável e Web Push foram iniciados nesta
etapa. Procedimentos de configuração, retentativa e limites de homologação
estão em `docs/ENTREGA-AGENDA.md`. A habilitação em produção depende de revisão
de logs, migração e validação em dispositivos reais.
