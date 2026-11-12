# Evidências de validação

> Registro histórico da etapa inicial. O plano vigente está em [PLANO-TESTES.md](PLANO-TESTES.md), atualizado em 12/11/2026 com os perfis reais de homologação, evoluções da agenda e catálogo de locais. Os limites abaixo descrevem aquela execução; não anulam evidências posteriores nem comprovam homologação completa.

## Jornada

Coordenação autentica → cadastra ministros, assistidos e agenda → recebe impedimentos → gera rascunho → ajusta → aprova → publica → ministro consulta seus compromissos e baixa a versão permitida.

## Verificado neste desenvolvimento

- TypeScript e build de produção.
- Regras de impedimento específico, dia e período; sobreposição; limites; casais; equidade e determinismo.
- Rejeição de visitas fora de domingo e dados inválidos.
- Autorização de PDF e acesso operacional por identidade, verificação de e-mail e vínculo.
- AES-GCM com nonce variável e rejeição de adulteração.
- PDF multipágina sem transportar contatos/observações privadas.
- Migração SQL, gravação/leitura cifrada, atualização de versão, auditoria e rollback, no PGlite.

## Limites da verificação

Não foram disponibilizadas credenciais Auth0 ou conexão de banco externo. Login real, sessão, permissões fim a fim e migração em PostgreSQL externo não foram executados. O navegador remoto não alcançou o servidor local (`ERR_CONNECTION_REFUSED`); a execução local de Chromium foi bloqueada pelo ambiente. A interface responsiva e acessibilidade foram implementadas, mas ainda requerem homologação visual em navegador/dispositivos reais.

Nenhuma alteração de DNS, implantação ou migração em produção foi feita.
