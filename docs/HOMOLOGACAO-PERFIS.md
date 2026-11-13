# Homologação por perfil

Em `/acesso-dev`, use a senha de homologação existente e escolha Coordenador, Ministro de teste A ou Ministro de teste B. Uma faixa no topo identifica a visão e permite alternar sem repetir a senha durante a sessão válida. O controle existe somente quando Preview está explicitamente configurado; não é disponibilizado em produção.

Os dois ministros são cadastros sintéticos completos e distintos, criados uma única vez após autenticação no banco isolado do Preview. Seus acessos persistidos têm papel MINISTER. A aplicação usa a resolução normal do cadastro, permissões, impedimentos, perfil próprio, respostas, PDFs e designações. Edição de dados, inativação, desligamento e revogação não são desfeitos ao alternar. Um perfil revogado/inativo deve ser restaurado pela coordenação para voltar a servir como ministro; é possível retornar ao seletor e testar outro perfil.

A troca é uma ferramenta exclusiva de homologação, autorizada pela sessão cifrada obtida com a senha compartilhada. Não equivale a uma permissão de produção para um ministro se promover. Perfil arbitrário, sessão adulterada/expirada e papel administrativo indevido nos acessos de ministro são rejeitados. O servidor revalida o acesso durante ações protegidas. O menu de teste apresenta as opções do ministro; rotas administrativas continuam protegidas no servidor.

A sessão dura uma hora, usa cookie HttpOnly, Secure e SameSite estrito e tem novo formato versionado. Sessões antigas precisam de novo login. Login/troca são limitados e auditados. Sair remove a sessão. Autenticação Auth0 de produção e seus controles continuam preservados.

## Roteiro de validação

1. Entrar como coordenador e conferir os cadastros sintéticos após o primeiro acesso a cada perfil de ministro.
2. Selecionar Ministro A. Conferir menu, editar Meus dados, informar impedimentos e concluir a resposta mensal, inclusive sem impedimentos.
3. Abrir uma URL administrativa diretamente: o papel de ministro não deve permitir cadastrar/alterar dados administrativos.
4. Como coordenador, designar A e B em eventos fictícios e publicar uma escala de teste. Voltar a A e conferir Minhas escalas, notificações e PDFs autorizados. Testar B para distinguir acesso próprio do acesso de terceiros.
5. Revogar/inativar A pela coordenação; trocar para A e confirmar a negativa, inclusive para operações já abertas. B deve continuar disponível.
6. Restaurar explicitamente o perfil para outras validações. Não há limpeza automática de impedimentos, dados editados ou escalas: as ações alteram o banco de homologação.

Os perfis não adicionam automaticamente missas, visitas nem publicações. A coordenação prepara os cenários desejados. Os testes locais cobrem sessão, papéis, persistência idempotente, revogação, inativação e bloqueio administrativo; não substituem o fluxo real Auth0 nem a homologação manual no navegador.

## Operação

Nenhuma variável nova é necessária: são usadas as configurações de Preview existentes. O build passa a executar somente a compilação, sem reimportar o legado a cada deploy. A importação continua disponível como operação explícita em `scripts/import-legacy.ts`, com validação de ambiente, destino e papel restrito. Produção e dados legados não são alterados por esse deploy.
