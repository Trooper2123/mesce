# MVP — entrega e promoção

## Estado desta branch

43 tasks no [GitHub](https://github.com/Trooper2123/mesce/issues), com rastreabilidade em [TASKS.md](../TASKS.md). O escopo implementado inclui o ingresso por allowlist, edição própria, agenda futura, respostas mensais, correções de integridade da escala e separação dos PDFs.

## Evidências já obtidas

- 37 testes locais aprovados; TypeScript, formatação e build de produção aprovados.
- Cenários da auditoria cobertos: escassez de candidatos, conflito que atravessa o mês, agenda alterada no rascunho e dados livres de visitas excluídos do PDF geral.
- Testes SQL/PGlite: ingresso permitido/negado, identidade verificada, UUID estável, idempotência, revogação e rate limiting.
- Branch Neon de homologação criada a partir do legado: `mesce-nextjs-mvp`, ID `br-winter-sky-b6p23c44`, projeto `aged-haze-35043202`.
- Migrations 001 e 002 executadas nessa branch, sem alterar tabelas legadas.
- Role runtime de homologação `mesce_mvp_runtime`: leitura e escrita nas tabelas operacionais necessárias; auditoria somente SELECT/INSERT; sem UPDATE/DELETE na auditoria e sem CREATE no schema. Permissões verificadas no PostgreSQL externo.
- Chaves e credenciais não entram no repositório. Nenhuma migração foi aplicada ao banco principal nesta entrega.

## Jornada MVP

1. Coordenação entra pelo Auth0 já configurado. Papel legado ativo é reconhecido por auth0_sub; a lista de e-mails em env é apenas bootstrap opcional.
2. Coordenação autoriza a lista em Pré-cadastros. Cada autorização reserva um UUID, mas não cria nome ou contato fictício.
3. Ministro autentica. Sem e-mail verificado ou fora da allowlist, o cadastro é negado. Pendente só acessa a conclusão; ativo entra no sistema.
4. Ministro conclui o cadastro e pode editar Meus dados. Identidade, e-mail de acesso, papéis e permissões não são aceitos do formulário.
5. Coordenação organiza celebrações/visitas futuras. Visitas têm visualização própria de domingos e continuam vinculadas ao cadastro protegido do assistido.
6. Ministros informam impedimentos e concluem a resposta mensal, inclusive sem impedimentos. A coordenação consolida os recebimentos e escolhe a política de não resposta em Configuração.
7. Coordenação gera, sincroniza agenda, ajusta e aprova. Publicar exige revalidação das restrições atuais.
8. PDF geral exclui título/local livre de visitas. Guia com contatos é separado, baseado no snapshot aprovado e restrito ao responsável pela visita ou coordenação.

## Antes de promover para produção

- [ ] Preview READY no commit final e CI GitHub aprovada.
- [ ] Entrar no Preview com a senha de homologação já configurada e testar cadastros, allowlist, revogação, agenda e escala.
- [ ] Homologar o fluxo real Auth0 (callback padrão preservada em /api/auth/callback), e-mail verificado, ministro autorizado e usuário fora da lista.
- [ ] Validar importação na branch isolada com a chave original. Se a chave de Preview diferir da original, a importação deve falhar e reverter; não rotacionar/copiar segredos indiscriminadamente.
- [ ] Confirmar que os dados legados existentes foram reconciliados. O importador para se encontrar visitas, impedimentos ou designações ainda sem mapeamento; não ignorar esse bloqueio.
- [ ] Criar/validar role runtime restrita equivalente em produção e apontar a URL de produção ao destino confirmado, sem reutilizar banco de Preview.
- [ ] Aplicar migrations aditivas no banco de produção, executar importação controlada e verificar contagens antes de promover.
- [ ] Confirmar política mensal, permissões de guia, operação de backup e responsáveis pelo suporte.

## Limitações materiais e tasks abertas

- O gerador usa prioridade por escassez e busca com orçamento fixo. Não promete ótimo matemático global; vagas restantes exigem revisão humana.
- A importação converte os formatos cifrados Go para o formato Next.js, preserva UUIDs e não apaga o legado. Campos sem correspondência temporal/funcional não devem ser preenchidos silenciosamente. A duração das celebrações legadas recebe o padrão de 60 minutos e precisa de revisão antes de agendamento operacional.
- A cópia das tabelas novas em homologação não comprova que a chave de dados daquele ambiente decifra registros legados. Essa homologação exige o runtime que contém a chave correta.
- Ainda há incrementos nas tasks de notificações, personalização, relatórios, histórico completo, séries com exceções, retenção/restauração e UX/acessibilidade em dispositivos físicos.
- Configurações de saldo/pontuação, exceções de casal e frequência/grupos de visitas dependem das decisões indicadas na auditoria. Nenhum peso foi inventado.
- Não foi feito teste de login real com credenciais pessoais. Testes locais e build não substituem esse passo.

## Fluxo de código

Feature → PR para dev → homologação em Preview → PR dev para main. Não executar force push. Main é produção. O usuário mesclou a PR inicial; as mudanças deste MVP seguem em nova branch e nova PR, sem promoção automática.
