# Login em Preview e domínios de produção

Em 11/11/2026, o deploy da branch `dev` com commit `16ad292` estava marcado como **production** na Vercel. A URL única iniciava Auth0, mas `APP_BASE_URL` apontava para `https://mescensrdf.vercel.app` e o callback era `/api/auth/callback`. O cookie de transação criado no domínio da URL única não acompanha o retorno em outro domínio. Essa divergência reproduz a condição que causa `The state parameter is invalid`.

## Comportamento corrigido

- Em production, `/auth/login` em uma URL alternativa redireciona para a origem HTTPS de `APP_BASE_URL` **antes** de o SDK emitir o cookie de transação.
- O login e o callback permanecem na mesma origem. `state`, PKCE, cookies HttpOnly e autorização seguem validados pelo SDK.
- Não repassar links de compartilhamento do deploy ao provedor. O redirecionamento entre domínios preserva somente `returnTo` local e válido.
- Em Preview com configuração completa de homologação, o proxy não aciona Auth0. Links antigos `/auth/*` ou de callback retornam para `/acesso-dev` no próprio Preview.
- A sessão de homologação continua restrita a `VERCEL_ENV=preview`, modo explícito, senha e segredo válidos. Não habilitar bypass em production para corrigir este erro.

## Operação

Criar deploy **Preview** para homologação e verificar o target retornado pela Vercel. A branch `dev`, sozinha, não define o ambiente: um deploy manual em production recebe as variáveis de produção e usa Auth0.

Para iniciar uma nova transação de produção, usar `https://mescensrdf.vercel.app/auth/login`. Não reutilizar URLs de callback com `code`/`state` de tentativa anterior. Se a transação já foi iniciada no domínio errado, começar novo login; a correção não recupera cookies existentes em outro host.

Não é necessário trocar segredos, ampliar o domínio dos cookies para `vercel.app`, remover a checagem de state ou cadastrar callbacks wildcard. O Preview usa o banco e as variáveis de teste já configurados. Publicar um Preview não promove a correção ao domínio de produção.
