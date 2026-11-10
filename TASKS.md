# TASKS — MVP MESCE

43 tasks criadas no GitHub a partir da auditoria e das regras confirmadas. Este arquivo acompanha implementação; as issues continuam abertas enquanto houver homologação/aceite pendente. Resend e aceite individual de designações estão fora do fluxo.

## Escopo do MVP

Allowlist → login → conclusão de cadastro; ministro edita o próprio cadastro; cadastros protegidos; agendamentos futuros; impedimentos e resposta mensal; revisão/aprovação/publicação e PDF protegido. A implantação em produção exige validação real e migração antes de promover.

| Auditoria | Task                                                                                                          | Prioridade | Estado desta entrega               |
| --------- | ------------------------------------------------------------------------------------------------------------- | ---------- | ---------------------------------- |
| A-01      | [#3 — Preservação de perfis e identidade existentes](https://github.com/Trooper2123/mesce/issues/3)           | P0         | Parcial; detalhes em MVP-RELEASE   |
| A-02      | [#5 — Fluxo de homologação configurado](https://github.com/Trooper2123/mesce/issues/5)                        | P0         | Parcial; detalhes em MVP-RELEASE   |
| A-03      | [#6 — Migração e reconciliação dos dados Go → Next.js](https://github.com/Trooper2123/mesce/issues/6)         | P0         | Parcial; detalhes em MVP-RELEASE   |
| A-04      | [#4 — Agenda adicionada/alterada durante revisão](https://github.com/Trooper2123/mesce/issues/4)              | P0         | Implementada; homologação pendente |
| A-05      | [#2 — Maior cobertura possível de vagas](https://github.com/Trooper2123/mesce/issues/2)                       | P0         | Parcial; detalhes em MVP-RELEASE   |
| A-06      | [#11 — Conflitos entre meses e escalas vigentes](https://github.com/Trooper2123/mesce/issues/11)              | P0         | Implementada; homologação pendente |
| A-07      | [#7 — Minimização do PDF por destinatário](https://github.com/Trooper2123/mesce/issues/7)                     | P0         | Implementada; homologação pendente |
| A-08      | [#10 — Mudanças entre aprovação e publicação](https://github.com/Trooper2123/mesce/issues/10)                 | P0         | Implementada; homologação pendente |
| A-09      | [#8 — Configurações gerais da pastoral](https://github.com/Trooper2123/mesce/issues/8)                        | P1         | Parcial; detalhes em MVP-RELEASE   |
| A-10      | [#9 — Cadastro e múltiplas preferências de locais](https://github.com/Trooper2123/mesce/issues/9)             | P1         | Pendente / evolução                |
| A-11      | [#12 — Evitar dois dias seguidos ou duas missas no mesmo dia](https://github.com/Trooper2123/mesce/issues/12) | P1         | Implementada; homologação pendente |
| A-12      | [#16 — Métricas de equilíbrio e histórico consultável](https://github.com/Trooper2123/mesce/issues/16)        | P1         | Parcial; detalhes em MVP-RELEASE   |
| A-13      | [#15 — Pontuação e saldo histórico](https://github.com/Trooper2123/mesce/issues/15)                           | P1         | Pendente / evolução                |
| A-14      | [#13 — Campos personalizados](https://github.com/Trooper2123/mesce/issues/13)                                 | P2         | Pendente / evolução                |
| A-15      | [#14 — Ministro edita o próprio cadastro](https://github.com/Trooper2123/mesce/issues/14)                     | P1         | Implementada; homologação pendente |
| A-16      | [#18 — Conclusão da resposta mensal de impedimentos](https://github.com/Trooper2123/mesce/issues/18)          | P1         | Implementada; homologação pendente |
| A-17      | [#19 — Vários dias avulsos no mesmo envio](https://github.com/Trooper2123/mesce/issues/19)                    | P1         | Pendente / evolução                |
| A-18      | [#17 — Impedimentos com campos condicionais](https://github.com/Trooper2123/mesce/issues/17)                  | P1         | Pendente / evolução                |
| A-19      | [#20 — Retirar/cancelar impedimento próprio](https://github.com/Trooper2123/mesce/issues/20)                  | P1         | Parcial; detalhes em MVP-RELEASE   |
| A-20      | [#21 — Solicitar impedimentos e consolidar respostas](https://github.com/Trooper2123/mesce/issues/21)         | P1         | Parcial; detalhes em MVP-RELEASE   |
| A-21      | [#22 — Cancelar/remarcar eventos e séries com exceções](https://github.com/Trooper2123/mesce/issues/22)       | P1         | Parcial; detalhes em MVP-RELEASE   |
| A-22      | [#23 — Revisão pontual preservando alocações e vagas](https://github.com/Trooper2123/mesce/issues/23)         | P1         | Parcial; detalhes em MVP-RELEASE   |
| A-23      | [#24 — Cancelamento de versão e validação separada](https://github.com/Trooper2123/mesce/issues/24)           | P1         | Parcial; detalhes em MVP-RELEASE   |
| A-24      | [#25 — Origem das alocações e parâmetros aplicados](https://github.com/Trooper2123/mesce/issues/25)           | P1         | Parcial; detalhes em MVP-RELEASE   |
| A-25      | [#26 — Calendário próprio de visitas dominicais](https://github.com/Trooper2123/mesce/issues/26)              | P1         | Implementada; homologação pendente |
| A-26      | [#27 — Frequência e grupos de assistidos](https://github.com/Trooper2123/mesce/issues/27)                     | P1         | Pendente / evolução                |
| A-27      | [#29 — Proximidade e tempo de deslocamento](https://github.com/Trooper2123/mesce/issues/29)                   | P1         | Pendente / evolução                |
| A-28      | [#31 — Pré-cadastro por lista de e-mails autorizados](https://github.com/Trooper2123/mesce/issues/31)         | P1         | Implementada; homologação pendente |
| A-29      | [#28 — Conclusão, vínculo e revogação da allowlist](https://github.com/Trooper2123/mesce/issues/28)           | P1         | Implementada; homologação pendente |
| A-30      | [#30 — Notificações internas e lembretes](https://github.com/Trooper2123/mesce/issues/30)                     | P1         | Pendente / evolução                |
| A-31      | [#32 — Web Push resiliente](https://github.com/Trooper2123/mesce/issues/32)                                   | P2         | Pendente / evolução                |
| A-32      | [#33 — PDF conforme modelo paroquial](https://github.com/Trooper2123/mesce/issues/33)                         | P1         | Parcial; detalhes em MVP-RELEASE   |
| A-33      | [#34 — Guia de visitas restrito em PDF](https://github.com/Trooper2123/mesce/issues/34)                       | P1         | Implementada; homologação pendente |
| A-34      | [#36 — Relatórios operacionais](https://github.com/Trooper2123/mesce/issues/36)                               | P1         | Pendente / evolução                |
| A-35      | [#35 — Dashboard completo e gráficos](https://github.com/Trooper2123/mesce/issues/35)                         | P2         | Pendente / evolução                |
| A-36      | [#37 — Consulta e rastreabilidade de auditoria](https://github.com/Trooper2123/mesce/issues/37)               | P1         | Parcial; detalhes em MVP-RELEASE   |
| A-37      | [#38 — Revogação de acesso e testes negativos reais](https://github.com/Trooper2123/mesce/issues/38)          | P0         | Parcial; detalhes em MVP-RELEASE   |
| A-38      | [#39 — Recuperação, limites e observabilidade](https://github.com/Trooper2123/mesce/issues/39)                | P1         | Parcial; detalhes em MVP-RELEASE   |
| A-39      | [#40 — Retenção, backup/restauração e correção/eliminação](https://github.com/Trooper2123/mesce/issues/40)    | P1         | Pendente / evolução                |
| A-40      | [#41 — PWA e acessibilidade homologadas](https://github.com/Trooper2123/mesce/issues/41)                      | P2         | Pendente / evolução                |
| A-41      | [#42 — Contratos para futuros clientes móveis](https://github.com/Trooper2123/mesce/issues/42)                | P2         | Pendente / evolução                |
| A-42      | [#43 — Documentação e fluxo de branches atuais](https://github.com/Trooper2123/mesce/issues/43)               | P1         | Parcial; detalhes em MVP-RELEASE   |
| A-43      | [#44 — Agendamentos exclusivamente futuros](https://github.com/Trooper2123/mesce/issues/44)                   | P1         | Implementada; homologação pendente |

Ver [MVP-RELEASE.md](docs/MVP-RELEASE.md) para evidências, limitações e ordem de promoção. Não encerrar tasks de ponta a ponta apenas com testes unitários.
