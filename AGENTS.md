# AGENTS.md — Messe

## Objetivo e escopo
- Repositório oficial: `Trooper2123/mescef`; branch principal: `main`.
- Linguagem principal do projeto: ** Next.js com PostgreSQL**. Não substituir por Java, Go ou outro stack sem decisão explícita e documentada.
- A interface web será publicada no Vercel; 
-  Não inventar regras de negócio, modelos de dados ou papéis de usuário.

## Antes de implementar
1. Ler `AGENTS.md`, `README.md`, documentação e código existente relacionado à alteração.
2. Consultar documentação da **versão real** do compilador e das bibliotecas Node.js e TypeScript utilizadas; registrar limitações e comandos reprodutíveis.
3. Identificar arquivos, consumidores, testes, configurações e possível impacto sobre usuários e dados.
4. Preferir a menor implementação completa; não introduzir camadas, abstrações, serviços ou dependências sem necessidade demonstrada.
5. Identificar o ambiente e o destino de qualquer operação que altere dados ou publique código.

## Planejamento por SPEC
- Para funcionalidades relevantes, criar `.codex/specs/<feature>/requirements.md`, `design.md` e `tasks.md`, ou seguir o padrão de documentação equivalente que venha a ser definido no repositório.
- Em `requirements.md`, descrever objetivo, escopo, critérios de aceitação, regras de negócio confirmadas e casos de erro.
- Em `design.md`, documentar arquitetura, fluxos, limites de confiança, testes, riscos e dependências.
- Em `tasks.md`, registrar implementação e validações, usando status `pending`, `in_progress`, `blocked` e `completed`.
- Definir testes e análise de segurança antes do código. Somente marcar `completed` após executar as validações pertinentes; na ausência delas, registrar `blocked`.
- Documentação em `.codex/` é de planejamento local; mantê-la fora dos commits, exceto se uma decisão explícita alterar esta política.

## Interface, UX e acessibilidade
- Todo texto de interface deverá estar em **português do Brasil**.
- Antes de criar páginas ou componentes, consultar `UI-GUIDE.md` e `design-system.md` **quando esses documentos existirem**.
- Centralizar cores, espaçamentos, tipografia e estados visuais em tokens; não criar hexadecimais avulsos em cada componente.
- Priorizar **alto contraste, tipografia grande, navegação simples e previsível**, controles com altura mínima de 48 px (onde aplicável), foco visível e HTML semântico. Evitar elementos piscantes, animações automáticas e excesso de estímulos; respeitar `prefers-reduced-motion` e validar teclado, zoom e WCAG 2.2 AA.
- HTML e CSS podem ser usados como recursos da web, mas lógica de domínio deverá permanecer em Node.js ou TypeScript sempre que tecnicamente viável.

## Arquitetura e deploy
- Separar código-fonte Node.js, artefatos compilados, arquivos estáticos e configurações de publicação.
- Não editar manualmente artefatos gerados como substituição permanente do código-fonte.
- Manter a configuração de produção vinculada ao repositório `Trooper2123/mesce` e à branch `main`.
- **Não disparar deploy para cada commit.** Previews automáticos estão desativados no Vercel por decisão do projeto; somente solicitar preview manual quando uma entrega estiver pronta para testes. A `main` é reservada à produção após revisão.
- Nunca afirmar que uma build, teste, integração Git ou deploy passou sem consultar o seu resultado real.
- Não inventar comandos: incluir no README os comandos exatos apenas quando confirmados por execução ou documentação compatível.

## Persistência
- Nunca limpar ou migrar dados de produção ou de ambientes compartilhados sem autorização e identificação do destino.
- Manter credenciais fora do repositório, usar consultas parametrizadas e testar integridade e isolamento de dados.
- Documentar mudanças de schema, migrações e seeds no `CHANGELOG.md`.

## Segurança obrigatória
- Aplicar OWASP Top 10, OWASP ASVS e práticas aplicáveis às tecnologias efetivamente usadas.
- Verificar autorização **no servidor** para operações protegidas; controles visuais não equivalem a autorização.
- Para APIs e entradas: validar formato, tamanho e tipo; prevenir injeção, XSS, CSRF, SSRF e acesso indevido por identificadores (IDOR/BOLA).
- Proteger segredos, tokens, dados pessoais e logs. Nunca enviar credenciais de backend ao JavaScript do cliente.
- Revisar autenticação, sessões, CORS, headers e rate limiting de acordo com a funcionalidade implementada.
- Incluir testes relevantes para `401`, `403`, isolamento entre usuários, entrada inválida e exposição indevida de dados quando houver contas ou APIs.
- Auditar alterações críticas (autenticação, APIs, persistência e parsing de entrada) com a skill `$security-audit` e executar varredura com `codex-security` (`cs scan`) antes da conclusão.
- Problemas críticos ou altos conhecidos relacionados à mudança impedem considerá-la concluída. Registrar bloqueios e riscos residuais.

## Testes e revisão pré-commit
1. Executar os testes pertinentes, verificações de tipos/compilação e lint disponibilizados pelo stack.
2. Validar build com os **comandos documentados e efetivamente disponíveis**.
3. Validar saída estática e fluxo Vercel quando houver alteração de publicação.
4. Verificar dependências, segredos expostos e mudanças de segurança ou persistência.
5. Executar verificação de segurança com `codex-security` (`cs scan`) e aplicar a skill `$security-audit` sobre os arquivos alterados (ou registrar a limitação e fazer revisão manual equivalente caso a ferramenta/skill não esteja instalada no ambiente).
6. Revisar impacto da alteração nos consumidores, configurações, fixtures e testes.
7. Executar a skill `pre-commit-review` quando estiver disponível; caso contrário, fazer revisão equivalente e registrar a limitação.
8. Manter `CHANGELOG.md` consistente com o diff, usando data/hora de Brasília, tipo (`feat`, `fix`, `refactor`, `style`, `chore` ou `docs`), principais arquivos e resultado.
9. Não realizar push com verificações obrigatórias falhando ou não realizadas; registrar o bloqueio em `tasks.md`.

## Ponytail — lazy senior dev mode
- O melhor código é o que não precisa ser escrito. Entregar a **menor mudança completa**.
- Reaproveitar padrões locais e bibliotecas existentes; evitar dependências para soluções de poucas linhas.
- Não criar abstrações, conversões, wrappers, opções ou arquivos “para o futuro” sem necessidade.
- Investigar a causa-raiz de defeitos e todos os chamadores antes da correção.
- Não sacrificar validação de entrada, segurança, tratamento de erro, acessibilidade ou requisitos explícitos.
- Toda nova lógica não trivial deve ter ao menos um teste pequeno ou uma autoverificação executável.
- Em respostas de implementação, indicar em uma ou duas linhas o que não foi verificado e os riscos restantes.

## Critérios para concluir
- Requisitos e critérios de aceitação verificados.
- Código, documentação e CHANGELOG alinhados.
- Testes, compilação e build pertinentes aprovados, com evidências registradas.
- Validação de segurança concluída via `codex-security` e `$security-audit`, garantindo ausência de segredos e vulnerabilidades críticas ou altas conhecidas relacionadas à entrega.
- Implantação confirmada quando fizer parte do escopo.
- Limitações, riscos e tarefas pendentes documentados.
