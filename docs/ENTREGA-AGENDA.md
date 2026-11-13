# Entrega de agenda: e-mail, outbox e Web Push

## Comportamento implementado

- Publicação e cancelamento enfileiram entregas na mesma transação que grava a escala.
- O processador imediato é aguardado depois do commit; falhas permanecem na fila.
- O endpoint `/api/jobs/outbox` processa lotes autenticados e permite retentativas.
- Convites são individuais, com um evento por e-mail, UID estável e sequência crescente. O conteúdo evita identificar assistidos.
- Push só é inscrito após clique explícito, com permissão do navegador. O aviso contém texto genérico e leva a `/minhas-escalas`.
- Preferências de e-mail e inscrições push ficam associadas ao ministro e à sessão autenticada. E-mail começa desativado.
- Assinaturas push inválidas podem ser revogadas; erros são repetidos com espera crescente, até cinco tentativas.

## Configuração

Aplicar as migrações até `005_delivery_outbox.sql`. Manter inicialmente as seguintes variáveis desativadas:

```env
MESCE_DELIVERY_OUTBOX_ENABLED=false
MESCE_EMAIL_SEND_ENABLED=false
MESCE_PUSH_ENABLED=false
```

Para homologar e-mail, habilitar o outbox e o canal apenas em ambiente controlado, e configurar `MESCE_SMTP_HOST`, `MESCE_SMTP_PORT`, `MESCE_SMTP_USER`, `MESCE_SMTP_PASSWORD` e `MESCE_SMTP_FROM`. O remetente deve ser autorizado pelo provedor SMTP. Usar conta sandbox ou destinatários de teste; não configurar DNS nem habilitar produção como parte desta entrega.

Para Web Push, criar chaves VAPID fora do repositório e configurar `MESCE_VAPID_PUBLIC_KEY`, `MESCE_VAPID_PRIVATE_KEY` e `MESCE_VAPID_SUBJECT`. A chave pública será entregue à interface; a chave privada permanece exclusivamente no servidor.

Configurar `CRON_SECRET` na Vercel. O cron chama `/api/jobs/outbox` diariamente como rede de segurança para tarefas que não foram concluídas na tentativa imediata. Em planos com execução diária, isso não fornece retentativa frequente; a frequência depende do plano. Sem segredo configurado, a rota responde 401.

## Limites de homologação

- SMTP aceitar a mensagem não prova entrega na caixa postal nem que o convite foi adicionado ao calendário.
- Push aceito pelo serviço não prova exibição, leitura ou abertura.
- O envio usa o e-mail verificado vinculado à conta; não há cadastro/validação de endereço alternativo nesta etapa.
- A instalação da PWA e as notificações precisam de validação em dispositivos reais, incluindo Safari/iOS e Android. No iOS/iPadOS, a PWA deve estar instalada na Tela de Início.
- Preview e produção devem continuar com as flags desligadas até revisar logs e homologar os fluxos com destinatários sintéticos.
- Não registrar endereço de e-mail, conteúdo iCalendar, endpoints push, chaves, dados de assistidos nem motivos privados em logs.
