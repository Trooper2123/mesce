# MESCE — Gestão pastoral

Aplicação em **Next.js (App Router), React, TypeScript e PostgreSQL**, com Auth0 para autenticação. A interface é em português e o backend roda no próprio Next.js; não depende de Go nem KofLang.

## Funcionalidades implementadas

- Painel mensal com indicadores e agenda.
- Cadastro e edição de ministros: situação limitada a ativo ou ex-ministro, nascimento, início no ministério, endereço, contatos, limite mensal, cônjuge recíproco e preferência de local/casal.
- Cadastro e edição de assistidos, telefones fixo/móvel, familiar de referência, endereço, situação e observações.
- Celebrações em várias datas e recorrência semanal permanente (horizonte inicial de 53 semanas), horários, duração, vagas e calendário mensal agrupado por mês. Editar uma ocorrência não altera as demais.
- Visitas vinculadas a assistidos ativos, exclusivamente aos domingos.
- Impedimentos por celebração, dia ou período inclusivo. Ministro informa os próprios impedimentos do próximo mês até o dia 25; coordenação pode complementar fora do prazo.
- Proposta determinística de escala, impedimentos, conflito de horários (incluindo missa das 10h e visita simultânea), ex-ministros, limite mensal combinado, local exclusivo e casal como unidade.
- Equilíbrio separado de celebrações/visitas considerando os últimos 12 meses publicados, sem duplicar revisões do histórico. Bairro igual desempata visitas após equilíbrio e preferência; não representa distância calculada.
- Ajustes manuais de pessoas/vagas com justificativa e revalidação. Reduzir vagas mantém excedentes para retirada explícita.
- Aprovação e publicação distintas; histórico de versões e snapshot aprovado preservado.
- PDF interno das versões aprovadas/publicadas, com paginação e sem dados domiciliares, telefones, nomes de assistidos ou observações privadas.
- Área do ministro: compromissos publicados e dados do assistido somente nas próprias visitas da última revisão publicada.
- A coordenação consulta a lista de ministros por situação; cada usuário gerencia seus próprios dados, e a coordenação mantém perfil de contato próprio.
- Dados pessoais cifrados com AES-256-GCM, consultas parametrizadas, auditoria e autorização no servidor. Sem cache offline de cadastros. Manifesto e ícone para identificação do aplicativo; não há service worker nem promessa de suporte offline.

## Executar localmente

Requisito: Node.js 24 e PostgreSQL 17+ (ou conexão PostgreSQL gerenciada).

```sh
npm ci
cp .env.example .env.local
docker compose up -d
# Preencha .env.local antes dos próximos comandos
npm run db:migrate
npm run dev
```

Acesse `http://localhost:3000`. Sem Auth0 configurado, a aplicação apresenta a página de configuração e não libera dados.

### Variáveis do servidor

| Variável                   | Uso                                                                        |
| -------------------------- | -------------------------------------------------------------------------- |
| `DATABASE_URL`             | Conexão PostgreSQL; use a URL com TLS fornecida pelo provedor em produção  |
| `AUTH0_DOMAIN`             | Domínio do tenant Auth0                                                    |
| `AUTH0_CLIENT_ID`          | Aplicação Regular Web Application                                          |
| `AUTH0_CLIENT_SECRET`      | Segredo do cliente, somente servidor                                       |
| `AUTH0_SECRET`             | Segredo de sessão (`openssl rand -hex 32`)                                 |
| `APP_BASE_URL`             | Origem do aplicativo, por exemplo `http://localhost:3000`                  |
| `MESCE_COORDINATOR_EMAILS` | E-mails da coordenação, separados por vírgula; exige `email_verified=true` |
| `MESCE_DATA_KEY_HEX`       | Chave AES de 32 bytes em hexadecimal (`openssl rand -hex 32`)              |

No Auth0, configure **Allowed Callback URLs** com `<APP_BASE_URL>/api/auth/callback` (ou o caminho definido em `MESCE_AUTH0_CALLBACK_PATH`) e **Allowed Logout URLs** com `<APP_BASE_URL>`. Habilite o fluxo de verificação de e-mail. Cadastre os ministros com o mesmo e-mail verificado usado no login. Nenhum usuário recebe função de coordenador por parâmetro do navegador. Login sem vínculo não permite acessar dados de cadastros nem PDF.

Guarde a chave de dados separadamente dos backups. Perder essa chave inviabiliza recuperar os dados cifrados; trocar seu valor exige recifrar os registros antes. Não há rotação automática nesta versão.

### Banco e concorrência

A migração é explícita e transacional; o build nunca cria tabelas. Os registros do MVP ficam em `mesce_records`, com tipo, payload cifrado, versão e timestamps. A auditoria em `mesce_audit` guarda identidade do usuário, operação e UUID, sem contatos ou motivos em claro. Justificativas e alterações detalhadas ficam em um campo cifrado. Uma alteração do casal e sua auditoria são atômicas. Ações de escrita usam advisory lock transacional para serializar geração e revisão concorrentes.

A modelagem cifrada exige ler os registros para aplicar regras no servidor. É adequada como implementação inicial de uma pastoral; para alto volume, separar índices operacionais e relações normalizadas, preservando a proteção dos campos pessoais. Use uma role de runtime sem DDL e uma credencial separada para migrações.

Veja também [o estado e os ajustes da integração existente](docs/INTEGRACAO-GITHUB-VERCEL.md). O código aceita as URLs `NEON_MESCE_*` já cadastradas; Preview exige o override isolado `MESCE_DATABASE_URL`.

## Publicar na Vercel

1. Importe este repositório como projeto Next.js.
2. Configure as variáveis acima no ambiente correto. Nenhuma delas deve usar prefixo `NEXT_PUBLIC_`.
3. Configure no Auth0 as URLs exatas da produção e de cada preview que será testado.
4. Aplique a migração ao PostgreSQL de destino de forma explícita, a partir de ambiente controlado. `npm run db:migrate` lê `.env.local`; com variáveis já injetadas, execute `node --import tsx scripts/migrate.ts`.
5. Execute o build e valide login/logout, coordenação, conta de ministro e download negado antes de cadastrar dados reais.

O código está preparado para implantação; esta entrega não provisiona serviços, altera DNS ou executa migração em produção.

## Verificações

```sh
npm run typecheck
npm test
npm run build
npm run format:check
```

Os testes usam apenas dados sintéticos. A integração SQL executa a migração e operações de persistência no motor PostgreSQL embarcado PGlite. Ela não substitui teste de conexão/TLS, advisory locks e concorrência em um servidor PostgreSQL externo.

## Decisões operacionais desta versão

- Sem impedimento registrado, ministro ativo é elegível, sem alegar disponibilidade confirmada.
- Limite mensal conta celebrações e visitas em conjunto; equilíbrio mantém contagens separadas.
- Preferência de casal junto é obrigatória como unidade. Separado também impede designação conjunta nesta versão.
- Alterações de cadastro/eventos não modificam snapshots já aprovados. Gere nova revisão, confira ajustes, aprove e publique novamente.
- E-mail é a chave de vínculo com a identidade Auth0. Cadastros não são públicos.

## MVP operacional em desenvolvimento

A evolução da auditoria está rastreada em [TASKS.md](TASKS.md), com 43 issues no GitHub. Esta branch implementa:

- Lista de e-mails autorizados pela coordenação, ativação após login com e-mail verificado e conclusão de cadastro; nenhum token, convite ou serviço Resend.
- Vínculo persistido por Auth0 sub e revogação; coordenação legada ativa continua reconhecida.
- Meus dados: edição pelo próprio ministro, com campos protegidos e validação no servidor.
- Sessão de homologação somente em Preview, com senha server-side, cookie cifrado e limite de tentativas; nunca funciona em Production.
- Agendamentos futuros em Brasília; cancelamento com justificativa e calendário de domingos.
- Respostas mensais, inclusive sem impedimentos, e consolidação pela coordenação. A política inicial exige resposta/consolidação; a coordenação pode alterá-la em Configuração.
- Sincronização da agenda no rascunho, preservação de vagas/alocações na nova revisão, revalidação na publicação e conflitos com eventos de meses vizinhos.
- Prioridade por escassez e busca limitada para melhorar cobertura; vagas que excedam o orçamento de busca exigem revisão humana, sem promessa de ótimo global.
- PDF geral sem campos livres das visitas e guia de visitas com contatos restrito aos responsáveis e à coordenação.

**Migrações:** executar os arquivos SQL na ordem, primeiro em banco isolado. O script `db:migrate` é aditivo e transacional. A tela Configuração oferece importação não destrutiva de ministros/assistidos/celebrações legados. Ela exige a chave original; falha em decifrar ou presença de visitas/impedimentos/designações ainda não mapeadas reverte toda a importação. Os formatos cifrados Go e Next.js são diferentes.

**Auth0 existente:** a callback padrão foi mantida em `/api/auth/callback` para compatibilidade com a aplicação já configurada. O login do SDK continua em `/auth/login`. Não é necessário criar outro tenant. Não copiar credenciais Production para Preview.

**Estado de produção:** build/CI e testes não substituem homologação de login, acesso negado, migração e dados. Não executar promoção automática desta branch sem essa validação. Consulte `docs/MVP-RELEASE.md`.

Campos personalizados, notificações push, relatórios avançados, contratos móveis, retenção e extensões adicionais estão nas issues correspondentes. Resend foi descontinuado e não é pendência.

## Plano de testes

O [plano vigente do produto](docs/PLANO-TESTES.md) reúne cenários por perfil, prioridades, pré-condições, resultados esperados e modelo de evidência. Funcionalidades de agenda externa e push planejadas ficam separadas das entregas implementadas.
