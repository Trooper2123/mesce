# Tasks — ajustes do design audit

Referência de aceite: [DESIGN-AUDIT-SPEC.md](DESIGN-AUDIT-SPEC.md). UX-02 a UX-04 estão implementadas e aguardam validação visual nos tamanhos e perfis previstos. UX-01 e UX-05 a UX-08 continuam pendentes. Cada fase só é considerada concluída depois de revisão visual dos resultados; mudanças de lógica ou de dados exigem task própria.

| ID    | Fase | Task                                                                                                         | Arquivos prováveis                                                                      | Critério de conclusão                                                                                         |
| ----- | ---- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| UX-01 | 1    | Levantar capturas e percurso atual nos quatro tamanhos e dois perfis, incluindo menu, visão geral e escalas. | Evidências de homologação                                                               | Referência antes da mudança registrada, com limitações de acesso anotadas.                                    |
| UX-02 | 1    | Indicar rota atual e reorganizar a navegação estreita sem rolagem horizontal como único meio de descoberta.  | `src/app/layout.tsx`, `src/app/globals.css`                                             | DS-01 aprovado por toque, teclado e zoom; conferir relação com a issue #80.                                   |
| UX-03 | 1    | Ajustar peso visual das ações na visão geral por perfil.                                                     | `src/app/page.tsx`, `src/app/globals.css`                                               | DS-02 aprovado; destinos e rótulos preservados.                                                               |
| UX-04 | 1    | Separar consulta, progressão do estado e ações auxiliares na escala mensal.                                  | `src/app/escalas/page.tsx`, `src/app/globals.css`                                       | DS-03 aprovado em ausência de escala e nos quatro estados; operações preservadas.                             |
| UX-05 | 2    | Documentar os tokens existentes e os novos valores aprovados antes de aplicá-los.                            | `docs/DESIGN_SYSTEM.md`, `src/app/globals.css`                                          | Tokens nomeados e justificados; nenhum valor novo sem uso concreto.                                           |
| UX-06 | 2    | Consolidar estilos compartilhados e hierarquia de painéis/tabelas.                                           | `src/app/globals.css`, `src/app/escalas/page.tsx`, `src/app/relatorios/page.tsx`        | DS-04 e DS-05 aprovados nos quatro tamanhos; contraste, foco e tabelas verificados.                           |
| UX-07 | 3    | Uniformizar estados vazios, carregamento, erro e feedback visual de interação.                               | `src/app/globals.css`, `src/app/loading.tsx`, `src/app/error.tsx`, páginas com `.empty` | DS-06 aprovado sem novos destinos ou mudanças de operação.                                                    |
| UX-08 | 3    | Revisar os percursos finais e registrar evidências antes/depois.                                             | Evidências de homologação; plano de testes, se necessário                               | Coordenação e ministro verificados em 320, 390, 768 e 1280 px, teclado e zoom de 200%; pendências explícitas. |

## Ordem e dependências

1. UX-01 antes de qualquer alteração visual.
2. UX-02 a UX-04 compõem a fase 1; revisar essa fase antes de UX-05.
3. UX-05 antecede UX-06 e UX-07, pois os novos valores devem existir no sistema visual antes do uso.
4. UX-08 encerra a verificação de todas as fases e fornece evidência para a issue #80 no que se refere à navegação e às tabelas no celular.

## Cuidados de implementação

- Não alterar ações, argumentos de formulários, permissões ou filtros por efeito de rearranjo visual.
- Não remover textos operacionais da escala sem verificar o fluxo descrito na especificação.
- Preservar o link de salto, os rótulos acessíveis, o foco visível e a legenda das categorias do calendário.
- O repositório tem alterações locais pré-existentes; limitar cada task aos arquivos indicados e às dependências reais encontradas na implementação.
