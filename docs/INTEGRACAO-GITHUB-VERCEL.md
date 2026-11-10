# Integração GitHub e Vercel

## Destino confirmado

- Repositório pretendido: `Trooper2123/mesce`, branch de produção pretendida `main`.
- Projeto Vercel existente: `mesce-nsrdf`, equipe `tereza-s-cereja`.
- ID do projeto: `prj_UFsThSH6MNlV1j1l9tWI4O2MplwT`.
- ID da equipe: `team_mp3jQiTzVFrpq2peVdXvivr3`.
- Origem de produção configurada: `https://mescensrdf.vercel.app`.
- A Vercel já informa vínculo com `Trooper2123/mesce`. O último deployment publicado ainda veio de `Trooper2123/mesce-nsrdf`, commit `0a06c07e12e81f489059e8718ceec73dbe62d468`.

## Ajustes aplicados

No projeto Vercel: preset Next.js, Node.js 24, instalação `npm ci`, build `npm run build`, desenvolvimento `npm run dev`, raiz do repositório e diretório de saída automático. `APP_BASE_URL` foi criado apenas em Production. Os demais segredos foram preservados, sem ler valores.

No código: `vercel.json`, versão Node em `package.json`, vínculo local `.vercel/project.json` ignorado pelo Git e resolução dos nomes de conexão existentes do Neon. Migrações continuam explícitas e não rodam durante o build.

## Conexões do banco

Runtime de produção: `MESCE_DATABASE_URL` → `DATABASE_URL` → `NEON_MESCE_DATABASE_URL` → `POSTGRES_URL` → `NEON_MESCE_POSTGRES_URL`.

Migração fora de Preview: override `MESCE_DATABASE_URL` primeiro; depois conexões diretas `DATABASE_URL_UNPOOLED`, `NEON_MESCE_DATABASE_URL_UNPOOLED`, `POSTGRES_URL_NON_POOLING` ou `NEON_MESCE_POSTGRES_URL_NON_POOLING`; depois as URLs normais.

Em Preview, `MESCE_DATABASE_URL` é obrigatório e tem exclusividade para impedir uso acidental das credenciais de produção herdadas da integração. O projeto já possui esse override em Preview, cuja associação ao banco isolado está descrita no comentário de configuração; não foi feita conexão SQL para validar seu destino.

## GitHub liberado

A instalação GitHub foi corrigida pela responsável. A escrita agora está autorizada. O GitHub confirmou que o repositório estava vazio; a `main` foi inicializada com README para receber a implementação por branch e pull request. Não foi substituído histórico anterior.

A implementação será validada em Preview antes da promoção para produção. As mudanças de configuração da Vercel não publicam o app por si só.

## Pendências antes da primeira publicação Next.js

1. Validar a pull request e o Preview; mesclar na `main` somente após as validações operacionais abaixo.
2. Definir `MESCE_COORDINATOR_EMAILS` com os e-mails verificados da coordenação em Production (e os de teste em Preview, se necessário).
3. No Auth0, autorizar `https://mescensrdf.vercel.app/auth/callback` e logout em `https://mescensrdf.vercel.app`. Autorizar separadamente uma URL de Preview estável; os segredos Auth0 atuais estão apenas em Production.
4. Aplicar e validar a migração das tabelas `mesce_records` e `mesce_audit` em um ambiente isolado. Os dados do sistema Go não são automaticamente migrados para o modelo novo.
5. Validar login, permissões, leitura/gravação e PDF em Preview; depois efetuar a publicação de produção.

Nenhum deployment, migração de produção, mudança de DNS, cópia de segredo ou rotação de chave foi feito nesta configuração. A aplicação antiga publicada permanece ativa.
